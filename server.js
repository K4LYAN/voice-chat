const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const cluster = require('cluster');
const os = require('os');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient: createClientRedis } = require('redis'); // Renamed to avoid config
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss');
const promClient = require('prom-client');
const { instrument } = require('@socket.io/admin-ui');
require('dotenv').config();

// --- ADMIN SECURITY MIDDLEWARE ---
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Default fallback

const requireAdmin = (req, res, next) => {
    const authHeader = req.headers['x-admin-password'];
    if (!authHeader || authHeader !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid Admin Password' });
    }
    next();
};

// --- LOGGING ---
const MAX_LOG_SIZE = 1000;
const matchHistory = []; // { timestamp, userA, userB, duration, reason }

// Helper to log match
const logMatch = (userA, userB, duration, reason) => {
    const entry = {
        timestamp: new Date().toISOString(),
        userA: userA ? { ip: userA.handshake.address, device: userA.handshake.query.deviceHash } : 'Unknown',
        userB: userB ? { ip: userB.handshake.address, device: userB.handshake.query.deviceHash } : 'Unknown',
        duration,
        reason
    };
    matchHistory.unshift(entry);
    if (matchHistory.length > MAX_LOG_SIZE) matchHistory.pop();
};

// --- Enhanced Logging Utility ---
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.INFO;
const log = {
    _format: (level, msg, data) => {
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
        return `[${timestamp}] [${level}] ${msg}${dataStr}`;
    },
    debug: (msg, data) => currentLogLevel <= LOG_LEVELS.DEBUG && console.log(log._format('DEBUG', msg, data)),
    info: (msg, data) => currentLogLevel <= LOG_LEVELS.INFO && console.log(log._format('INFO', msg, data)),
    warn: (msg, data) => currentLogLevel <= LOG_LEVELS.WARN && console.warn(log._format('WARN', msg, data)),
    error: (msg, data) => currentLogLevel <= LOG_LEVELS.ERROR && console.error(log._format('ERROR', msg, data)),
};

// --- Prometheus Metrics Setup ---
const register = promClient.register;
promClient.collectDefaultMetrics({ register }); // Collect default Node.js metrics

// Custom Metrics
const activeUsersGauge = new promClient.Gauge({
    name: 'voice_chat_active_users',
    help: 'Number of currently connected users',
});
const usersInQueueGauge = new promClient.Gauge({
    name: 'voice_chat_users_in_queue',
    help: 'Number of users waiting in queue',
});
const activeRoomsGauge = new promClient.Gauge({
    name: 'voice_chat_active_rooms',
    help: 'Number of active chat rooms',
});
const matchesCounter = new promClient.Counter({
    name: 'voice_chat_matches_total',
    help: 'Total number of matches made',
});
const blockedConnectionsCounter = new promClient.Counter({
    name: 'voice_chat_blocked_connections_total',
    help: 'Total connections blocked by IP or device hash',
});

// --- In-Memory Stats (for /admin/stats) ---
const serverStartTime = Date.now();
const stats = {
    totalConnections: 0,
    totalMatches: 0,
    peakUsers: 0,
};

// --- Blocked Lists (In-Memory, synced to Redis if available) ---
const blockedIps = new Set();
const blockedDevices = new Set();

// --- Blocked Attempts Log (for real-time dashboard) ---
const MAX_BLOCKED_ATTEMPTS = 50;
const blockedAttempts = [];

// --- Active Connections Tracking (for real-time dashboard) ---
const activeConnections = new Map(); // socketId -> { ip, deviceHash, connectedAt }


const numCPUs = process.env.WEB_CONCURRENCY || 1; // Default to 1 worker for free/shared tiers to avoid OOM

// --- SUPABASE SETUP ---
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    console.log('✅ Supabase Client Initialized');
} else {
    console.warn('⚠️ Supabase credentials missing. Bans will NOT be persistent.');
}

// --- BAN SYSTEM STORE ---
// In-memory cache for fast lookups, synced with DB
const blockedUsersCache = new Map(); // Key: IP or DeviceHash -> { reason, expiresAt, severity }
const reportedUsers = new Map(); // socketId -> { reports: [], count: 0 }

const loadBlockedList = async () => {
    if (!supabase) return;
    try {
        const { data, error } = await supabase.from('blocked_users').select('*');
        if (error) throw error;

        blockedUsersCache.clear();
        const now = new Date();
        data.forEach(ban => {
            const expiresAt = ban.expires_at ? new Date(ban.expires_at) : null;
            if (!expiresAt || expiresAt > now) {
                // Determine key (IP or DeviceHash)
                if (ban.ip) blockedUsersCache.set(ban.ip, { ...ban, type: 'ip', expiresAt });
                if (ban.device_hash) blockedUsersCache.set(ban.device_hash, { ...ban, type: 'device', expiresAt });
            }
        });
        console.log(`Loaded ${blockedUsersCache.size} active bans from Supabase`);
    } catch (err) {
        console.error('Failed to load bans:', err.message);
    }
};

// Initial Load
loadBlockedList();

// Clustering only works in production (nodemon breaks it in dev)
if (cluster.isPrimary && process.env.NODE_ENV === 'production') {
    console.log(`Primary ${process.pid} is running`);
    console.log(`Forking ${numCPUs} workers...`);

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
        // Optional: Restart worker
        cluster.fork();
    });
} else {
    // Worker Process (or single process in dev)
    const app = express();

    // Security Middleware
    // Security Middleware
    // Content Security Policy (A05: Security Misconfiguration)
    app.enable('trust proxy'); // Required for correct IP/Rate-limit behind Load Balancers (Heroku/Render/AWS)
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline often needed for React dev
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "blob:"],
                connectSrc: ["'self'", "https:", "wss:", "wss://0.0.0.0:5000"], // Allow wss connections
            },
        },
    }));
    app.use(cors()); // CORS (Adjust origin in production)

    // Rate Limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5000, // Scalability: Increased for 10k users (many might share NAT/IP)
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(limiter);

    app.get('/', (req, res) => {
        res.send('Secure Voice Chat Server is Running!');
    });

    // --- Health Check Endpoint ---
    app.get('/health', async (req, res) => {
        const healthData = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: Math.floor((Date.now() - serverStartTime) / 1000) + 's',
            redis: useRedis ? 'connected' : 'in-memory-fallback',
            memory: process.memoryUsage(),
        };
        res.json(healthData);
    });

    // --- Prometheus Metrics Endpoint ---
    app.get('/metrics', async (req, res) => {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    });

    // --- Admin Stats Endpoint (JSON) ---
    app.get('/admin/stats', requireAdmin, async (req, res) => {
        try {
            const sockets = await io.fetchSockets();
            const uptime = process.uptime();

            res.json({
                currentUsers: sockets.length,
                totalConnections: stats.totalConnections,
                totalMatches: stats.totalMatches,
                peakUsers: stats.peakUsers,
                uptime: Math.floor(uptime) + 's'
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // --- Admin Block Management Endpoints ---
    app.post('/admin/block/ip/:ip', requireAdmin, express.json(), async (req, res) => {
        const { ip } = req.params;
        const reason = req.body.reason || 'Admin Manual Block';
        const severity = req.body.severity || 'level2'; // Default: Permanent

        // Cache Update
        blockedUsersCache.set(ip, { reason, severity, expiresAt: null, type: 'ip' });

        // DB Update
        if (supabase) {
            await supabase.from('blocked_users').insert([{
                ip: ip,
                reason,
                severity,
                expires_at: null
            }]);
        }

        log.warn(`IP blocked: ${ip}`);
        res.json({ success: true, message: `IP ${ip} blocked` });
    });

    app.delete('/admin/block/ip/:ip', requireAdmin, async (req, res) => {
        const { ip } = req.params;
        blockedUsersCache.delete(ip);
        if (supabase) {
            await supabase.from('blocked_users').delete().eq('ip', ip);
        }
        log.info(`IP unblocked: ${ip}`);
        res.json({ success: true, message: `IP ${ip} unblocked` });
    });

    app.post('/admin/block/device/:hash', requireAdmin, express.json(), async (req, res) => {
        const { hash } = req.params;
        const reason = req.body.reason || 'Admin Manual Block';
        const severity = req.body.severity || 'level2'; // Default: Permanent

        // Cache Update
        blockedUsersCache.set(hash, { reason, severity, expiresAt: null, type: 'device' });

        // DB Update
        if (supabase) {
            await supabase.from('blocked_users').insert([{
                device_hash: hash,
                reason,
                severity,
                expires_at: null // Permanent
            }]);
        }

        log.warn(`Device blocked: ${hash}`);
        res.json({ success: true, message: `Device ${hash} permanently blocked` });
    });

    app.delete('/admin/block/device/:hash', requireAdmin, async (req, res) => {
        const { hash } = req.params;
        blockedUsersCache.delete(hash);
        if (supabase) {
            await supabase.from('blocked_users').delete().eq('device_hash', hash);
        }
        log.info(`Device unblocked: ${hash}`);
        res.json({ success: true, message: `Device ${hash} unblocked` });
    });

    app.get('/admin/blocked', requireAdmin, (req, res) => {
        const blockedList = Array.from(blockedUsersCache.entries()).map(([key, val]) => ({
            key, ...val
        }));
        res.json({
            blocked: blockedList,
            total: blockedList.length
        });
    });

    // --- Real-time Blocked Attempts Log ---
    app.get('/admin/blocked/attempts', requireAdmin, (req, res) => {
        res.json({
            attempts: blockedAttempts,
            total: blockedAttempts.length
        });
    });

    // --- Active Connections with IP Addresses ---
    app.get('/admin/connections', requireAdmin, (req, res) => {
        const connections = [];
        activeConnections.forEach((data, socketId) => {
            connections.push({
                socketId,
                ip: data.ip,
                deviceHash: data.deviceHash,
                connectedAt: data.connectedAt,
                duration: Math.floor((Date.now() - new Date(data.connectedAt).getTime()) / 1000)
            });
        });
        connections.sort((a, b) => new Date(b.connectedAt) - new Date(a.connectedAt));
        res.json({ connections, total: connections.length });
    });

    // --- Queue Status ---
    app.get('/admin/queue', requireAdmin, (req, res) => {
        const queueStats = {
            total: 0,
            byGender: { male: 0, female: 0 },
            byPreference: { male: 0, female: 0 },
            users: []
        };
        activeConnections.forEach((data, socketId) => {
            if (data.inQueue) {
                queueStats.total++;
                if (data.gender) queueStats.byGender[data.gender] = (queueStats.byGender[data.gender] || 0) + 1;
                if (data.preferredGender) queueStats.byPreference[data.preferredGender] = (queueStats.byPreference[data.preferredGender] || 0) + 1;
                queueStats.users.push({
                    socketId,
                    ip: data.ip,
                    gender: data.gender || 'unknown',
                    preferredGender: data.preferredGender || 'any',
                    waitingTime: Math.floor((Date.now() - new Date(data.queueJoinedAt || data.connectedAt).getTime()) / 1000)
                });
            }
        });
        queueStats.users.sort((a, b) => b.waitingTime - a.waitingTime);
        res.json(queueStats);
        queueStats.users.sort((a, b) => b.waitingTime - a.waitingTime);
        res.json(queueStats);
    });

    // --- Reports Management ---
    app.get('/admin/reports', requireAdmin, (req, res) => {
        const reportsList = Array.from(reportedUsers.entries()).map(([hash, data]) => ({
            hash,
            ...data
        }));
        // Sort by report count descending
        reportsList.sort((a, b) => b.count - a.count);
        res.json({ reports: reportsList });
    });

    app.delete('/admin/reports/:hash', requireAdmin, (req, res) => {
        const { hash } = req.params;
        if (reportedUsers.has(hash)) {
            reportedUsers.delete(hash);
            res.json({ success: true, message: 'Reports cleared' });
        } else {
            res.status(404).json({ error: 'Report not found' });
        }
    });

    // --- Match History Logs ---
    app.get('/admin/logs/matches', requireAdmin, (req, res) => {
        res.json({ matches: matchHistory });
    });

    // --- Data Export ---
    app.get('/admin/export/:type', requireAdmin, (req, res) => {
        const { type } = req.params;
        let data = [];
        let fields = [];

        if (type === 'matches') {
            data = matchHistory;
            fields = ['timestamp', 'duration', 'reason', 'userA_ip', 'userA_device', 'userB_ip', 'userB_device'];
            data = data.map(m => ({
                timestamp: m.timestamp,
                duration: m.duration,
                reason: m.reason,
                userA_ip: m.userA?.ip || 'N/A',
                userA_device: m.userA?.device || 'N/A',
                userB_ip: m.userB?.ip || 'N/A',
                userB_device: m.userB?.device || 'N/A'
            }));
        } else if (type === 'connections') {
            // Export active connections history not tracked, export snapshot of current
            activeConnections.forEach((d, id) => data.push({ socketId: id, ...d }));
            fields = ['socketId', 'ip', 'deviceHash', 'connectedAt', 'inQueue'];
        } else if (type === 'blocked_attempts') {
            data = blockedAttempts;
            fields = ['timestamp', 'ip', 'deviceHash', 'reason'];
        } else {
            return res.status(400).json({ error: 'Unknown export type' });
        }

        const csv = [
            fields.join(','),
            ...data.map(row => fields.map(field => JSON.stringify(row[field] || '')).join(','))
        ].join('\n');

        res.header('Content-Type', 'text/csv');
        res.attachment(`${type}_logs_${Date.now()}.csv`);
        res.send(csv);
    });

    // Store io reference for admin endpoints (will be set after io is created)
    let ioInstance = null;

    // --- Force Disconnect User ---
    app.post('/admin/disconnect/:socketId', requireAdmin, (req, res) => {
        const { socketId } = req.params;

        if (!ioInstance) {
            return res.status(503).json({ success: false, message: 'Server not ready' });
        }

        try {
            const socket = ioInstance.sockets.sockets.get(socketId);
            if (socket) {
                socket.disconnect(true); // Force disconnect
                log.info(`Admin forced disconnect for ${socketId}`);
                res.json({ success: true, message: `User ${socketId} disconnected` });
            } else {
                res.status(404).json({ success: false, message: 'Socket not found' });
            }
        } catch (err) {
            log.error('Force disconnect error', { error: err.message });
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // --- Connection History Log ---
    const MAX_CONNECTION_HISTORY = 100;
    const connectionHistory = [];

    app.get('/admin/history', (req, res) => {
        res.json({
            history: connectionHistory,
            total: connectionHistory.length
        });
    });

    let server;
    let useRedis = false; // Moved declaration up for /health access

    // Production: Use HTTP (cloud platforms handle SSL termination)
    // Development: Use HTTP to avoid certificate trust issues
    server = http.createServer(app);

    if (process.env.NODE_ENV === 'production') {
        log.info('Production mode: HTTP (SSL handled by load balancer)');
    } else {
        log.info('Development mode: HTTP (no SSL certificates needed)');
    }

    const io = new Server(server, {
        cors: {
            // A05: Security Misconfiguration - Restrict CORS
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin) return callback(null, true);

                // Load allowed origins from ENV
                const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
                const defaultAllowedOrigins = [
                    'http://localhost:5173',
                    'http://127.0.0.1:5173',
                    'https://voice-chat-kappa.vercel.app', // Example
                    // TODO: ADD YOUR ACTUAL VERCEL DOMAIN HERE (e.g., https://voice-chat-client.vercel.app)
                    // 'https://your-app-name.vercel.app', 
                ];

                const mergedOrigins = [...defaultAllowedOrigins, ...allowedOrigins];

                // Allow exact matches OR Vercel deployments
                if (mergedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
                    // Origin allowed
                    callback(null, true);
                } else {
                    console.warn(`Blocked CORS origin: ${origin}`);
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ["GET", "POST"],
            credentials: true // Required for socket.io admin UI
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling']
    });

    // Set ioInstance for admin endpoints
    ioInstance = io;

    // --- Socket.io Admin UI ---
    instrument(io, {
        auth: false, // Set to { type: "basic", username: "admin", password: "secure_password" } for production
        mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    });

    // --- Socket.io Blocking Middleware ---
    io.use((socket, next) => {
        const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() || socket.handshake.address;
        const deviceHash = socket.handshake.auth?.deviceHash || socket.handshake.query?.deviceHash;

        // Check Cache for bans
        const checkBan = (key) => {
            const ban = blockedUsersCache.get(key);
            if (!ban) return null;

            // Check Expiry (if temp ban)
            if (ban.expiresAt && new Date(ban.expiresAt) < new Date()) {
                blockedUsersCache.delete(key); // Expired
                return null;
            }
            return ban;
        };

        const ipBan = checkBan(ip);
        const deviceBan = checkBan(deviceHash);

        // Check if blocked (Ignore 'warning' severity which is just for logging/display)
        if ((ipBan && ipBan.severity !== 'warning') || (deviceBan && deviceBan.severity !== 'warning')) {
            const ban = ipBan || deviceBan;
            log.warn(`Blocked connection attempt from ${ip} (${ban.reason})`);
            blockedConnectionsCounter.inc();

            blockedAttempts.unshift({
                timestamp: new Date().toISOString(),
                ip,
                deviceHash: deviceHash || 'N/A',
                reason: `${ban.severity === 'level1' ? 'Temp' : 'Perm'} Ban: ${ban.reason}`
            });
            if (blockedAttempts.length > MAX_BLOCKED_ATTEMPTS) blockedAttempts.pop();

            return next(new Error(`Banned: ${ban.reason}`));
        }

        // Attach IP and deviceHash to socket for later use
        socket.clientIp = ip;
        socket.deviceHash = deviceHash;
        next();
    });

    // Rate Limiter for Sockets (DoS Mitigation)

    const socketRateLimits = new Map();
    const RATE_LIMIT_WINDOW = 1000; // 1 second
    const MAX_EVENTS_PER_SEC = 10;

    const checkRateLimit = (socketId) => {
        const now = Date.now();
        const record = socketRateLimits.get(socketId) || { count: 0, start: now };

        if (now - record.start > RATE_LIMIT_WINDOW) {
            record.count = 1;
            record.start = now;
        } else {
            record.count++;
        }

        socketRateLimits.set(socketId, record);

        if (record.count > MAX_EVENTS_PER_SEC) {
            return false; // Rate limit exceeded
        }
        return true;
    };

    // Redis setup & Fallback
    let redisConfig;
    let pubClient, subClient, dbClient;
    // useRedis is declared above

    // In-Memory Storage Implementation (Fallback)
    class InMemoryStore {
        constructor() {
            this.store = new Map();
            this.hasExpiry = new Set();
        }

        async connect() { return true; }

        async set(key, value) { this.store.set(key, value); }
        async get(key) { return this.store.get(key); }

        // ZSET (Queue) Mock
        async zAdd(key, { score, value }) {
            if (!this.store.has(key)) this.store.set(key, []);
            const list = this.store.get(key);
            // Remove existing if any
            const idx = list.findIndex(i => i.value === value);
            if (idx !== -1) list.splice(idx, 1);

            list.push({ score, value });
            list.sort((a, b) => a.score - b.score);
        }

        async zPopMin(key) {
            if (!this.store.has(key)) return null;
            const list = this.store.get(key);
            if (list.length === 0) return null;
            return list.shift(); // Remove and return first (lowest score)
        }

        async zRem(key, value) {
            if (!this.store.has(key)) return;
            const list = this.store.get(key);
            const idx = list.findIndex(i => i.value === value);
            if (idx !== -1) list.splice(idx, 1);
        }

        // HSET (Session) Mock
        async hSet(key, object) {
            this.store.set(key, { ...object });
        }

        async hGetAll(key) {
            return this.store.get(key) || null;
        }

        async expire(key, seconds) {
            // Basic mock: just delete after timeout
            // In a real app we might track this proper, but for simple fallback calls this is fine
            // or we ignore it for short sessions.
            // Let's implement a simple timeout
            setTimeout(() => this.store.delete(key), seconds * 1000);
        }

        async del(key) {
            this.store.delete(key);
        }

        on(event, cb) { } // Mock event listener
    }

    const startServer = async () => {
        // Try to connect to Redis
        try {
            if (process.env.REDIS_URL) {
                redisConfig = { url: process.env.REDIS_URL };
            } else if (process.env.REDIS_HOST) {
                redisConfig = {
                    username: process.env.REDIS_USERNAME || 'default',
                    password: process.env.REDIS_PASSWORD,
                    socket: {
                        host: process.env.REDIS_HOST,
                        port: process.env.REDIS_PORT || 6379,
                        // Important for Render: some free redises need TLS
                        // But 'redis' package usually handles this via protocol in URL or defaults
                    }
                };
            }

            if (redisConfig) {
                console.log('Attempting Redis connection...');
                const tempPub = createClientRedis(redisConfig);
                const tempSub = tempPub.duplicate();
                const tempDb = createClientRedis(redisConfig);

                // Add error handlers to prevent crash during connect
                const ignoreErr = (err) => { };
                tempPub.on('error', ignoreErr);
                tempSub.on('error', ignoreErr);
                tempDb.on('error', ignoreErr);

                // Enforce a strict timeout for the connection
                const connectPromise = Promise.all([tempPub.connect(), tempSub.connect(), tempDb.connect()]);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Redis connection timed out')), 2000)
                );

                await Promise.race([connectPromise, timeoutPromise]);

                // If we get here, connection successful
                pubClient = tempPub;
                subClient = tempSub;
                dbClient = tempDb;

                // Restore normal error logging
                pubClient.removeAllListeners('error');
                subClient.removeAllListeners('error');
                dbClient.removeAllListeners('error');

                pubClient.on('error', (err) => console.error('Redis Pub Error:', err));
                subClient.on('error', (err) => console.error('Redis Sub Error:', err));
                dbClient.on('error', (err) => console.error('Redis DB Error:', err));

                io.adapter(createAdapter(pubClient, subClient));
                useRedis = true;
                console.log('✅ Connected to Redis (Scalable Mode)');
            } else {
                throw new Error('No Redis config');
            }
        } catch (e) {
            console.warn('⚠️ Redis connection failed or not configured. Falling back to In-Memory Store.');
            console.warn('⚠️ Note: Clustering/Scaling will not share state in this mode.');
            console.warn('Reason:', e.message);

            dbClient = new InMemoryStore();
            // No pub/sub for adapter needed if single instance, default memory adapter works for socket.io
            useRedis = false;
        }

        // --- Ops Abstractions ---

        // Helper to get client IP for reputation tracking
        const getClientIp = (socket) => {
            const forwarded = socket.handshake.headers['x-forwarded-for'];
            if (forwarded) return forwarded.split(',')[0].trim();
            return socket.handshake.address || 'unknown_ip';
        };

        const reputationOps = {
            getKey: (ip) => `reputation:${ip}`,
            get: async (ip) => {
                const score = await dbClient.get(`reputation:${ip}`);
                return parseInt(score) || 100; // Default score 100
            },
            update: async (ip, change) => {
                const key = `reputation:${ip}`;
                let current = await reputationOps.get(ip);
                let newScore = current + change;
                // Cap score range
                if (newScore > 500) newScore = 500;
                if (newScore < -100) newScore = -100;
                await dbClient.set(key, newScore);
                return newScore;
            }
        };

        // Helper to get queue key with gender and shadow ban support
        const getQueueKey = (lang, gender, preferredGender, isShadowBanned) => {
            const base = `queue:${lang}:${gender}:${preferredGender}`;
            return isShadowBanned ? `${base}:shadow` : base;
        };
        const getSessionKey = (socketId) => `session:${socketId}`;

        const queueOps = {
            push: async (lang, socketId, gender, preferredGender, score) => {
                // Determine if user is shadow banned based on score logic passed in, 
                // but checking reputation here might be redundant if done in join logic.
                // We will rely on the caller to pass the correct 'shadow' flag or key context if needed.
                // Actually, to keep it clean, let's look up the session or trust the caller to handle the key generation.
                // For this implementation, we'll update the signature to accept 'isShadowBanned'.
                // However, to avoid breaking existing calls immediately, let's adapt.
                // We'll refactor 'push' to take an options object or rely on the caller to generate the key?
                // Let's stick to the plan: caller determines shadow status.
                // See below for the 'push' signature update in the implementation logic.
                throw new Error("Use pushWithScore instead");
            },
            pushWithScore: async (lang, socketId, gender, preferredGender, isShadowBanned, reputation) => {
                const queueKey = getQueueKey(lang, gender, preferredGender, isShadowBanned);

                // Calculate Weighted Score (Priority Queue)
                // Lower score = Higher Priority (popped first via zPopMin)
                // Formula: ArrivalTime - (Reputation * Multiplier)
                // 1 Rep Point = 1 Minute (60000ms) advantage
                const arrivalTime = Date.now();
                const timeBonus = reputation * 60 * 1000;
                const weightedScore = arrivalTime - timeBonus;

                await dbClient.zAdd(queueKey, { score: weightedScore, value: socketId });
            },
            pop: async (lang, gender, preferredGender, isShadowBanned) => {
                const queueKey = getQueueKey(lang, gender, preferredGender, isShadowBanned);
                const result = await dbClient.zPopMin(queueKey);
                return result ? result.value : null;
            },
            returnToFront: async (lang, socketId, gender, preferredGender, isShadowBanned) => {
                const queueKey = getQueueKey(lang, gender, preferredGender, isShadowBanned);
                // Return to front = Super high priority (very low score)
                await dbClient.zAdd(queueKey, { score: 0, value: socketId });
            },
            remove: async (lang, socketId, gender, preferredGender, isShadowBanned) => {
                const queueKey = getQueueKey(lang, gender, preferredGender, isShadowBanned);
                await dbClient.zRem(queueKey, socketId);
            }
        };

        const sessionOps = {
            set: async (socketId, data) => {
                const flatData = {};
                for (const [k, v] of Object.entries(data)) {
                    flatData[k] = String(v);
                }
                await dbClient.hSet(getSessionKey(socketId), flatData);
                await dbClient.expire(getSessionKey(socketId), 86400);
            },
            get: async (socketId) => {
                const data = await dbClient.hGetAll(getSessionKey(socketId));
                if (!data || Object.keys(data).length === 0) return null;

                // Parse booleans
                if (data.inQueue === 'true') data.inQueue = true;
                if (data.inQueue === 'false') data.inQueue = false;
                if (data.isShadowBanned === 'true') data.isShadowBanned = true;
                if (data.isShadowBanned === 'false') data.isShadowBanned = false;

                // Parse integers
                if (data.startTime) data.startTime = parseInt(data.startTime);

                return data;
            },
            delete: async (socketId) => {
                await dbClient.del(getSessionKey(socketId));
            }
        };

        // --- Socket Logic ---

        io.on('connection', (socket) => {
            // Update metrics
            stats.totalConnections++;
            const currentUsers = io.engine.clientsCount || 0;
            activeUsersGauge.set(currentUsers);
            if (currentUsers > stats.peakUsers) {
                stats.peakUsers = currentUsers;
            }

            log.info('User connected', { socketId: socket.id, ip: socket.clientIp, currentUsers });

            // Track this connection for admin dashboard
            activeConnections.set(socket.id, {
                ip: socket.clientIp || 'unknown',
                deviceHash: socket.deviceHash || 'N/A',
                connectedAt: new Date().toISOString()
            });

            // Middleware-like function for event handlers
            const withRateLimit = (handler) => {
                return (...args) => {
                    if (!checkRateLimit(socket.id)) {
                        log.warn(`Rate limit exceeded for ${socket.id}`);
                        socket.emit('error', 'Too many requests');
                        return;
                    }
                    handler(...args);
                };
            };

            // --- REPORT & AUTO-BAN LOGIC ---
            const handleUserReport = async (reporterSocket, targetSocketId, reason) => {
                // Prevent self-report abuse
                if (reporterSocket.id === targetSocketId) return;

                const targetSocket = io.sockets.sockets.get(targetSocketId);
                if (!targetSocket) return; // User already left?

                // Track Reports
                if (!reportedUsers.has(targetSocket.deviceHash)) {
                    reportedUsers.set(targetSocket.deviceHash, { reports: [], count: 0 });
                }

                const entry = reportedUsers.get(targetSocket.deviceHash);
                entry.count++;
                entry.reports.push({
                    reporter: reporterSocket.deviceHash,
                    reason,
                    timestamp: Date.now()
                });

                log.warn(`User ${targetSocketId} reported for ${reason}. Total: ${entry.count}`);

                // --- AUTO-BAN THRESHOLD ---
                // 3 Reports in 10 minutes -> Level 1 (Temp Class)
                // 5 Reports in 1 hour -> Level 2 (Perm Ban)

                if (entry.count >= 3) {
                    const severity = entry.count >= 5 ? 'level2' : 'level1';
                    const banReason = `Auto-Ban: Excessive Reports (${entry.count})`;
                    const expiresAt = severity === 'level1'
                        ? new Date(Date.now() + 5 * 60 * 1000) // 5 Min
                        : null; // Permanent

                    // Apply Ban
                    blockedUsersCache.set(targetSocket.clientIp, { reason: banReason, severity, expiresAt, type: 'ip' });
                    if (targetSocket.deviceHash) {
                        blockedUsersCache.set(targetSocket.deviceHash, { reason: banReason, severity, expiresAt, type: 'device' });
                    }

                    // Record DB
                    if (supabase) {
                        await supabase.from('blocked_users').insert([{
                            ip: targetSocket.clientIp,
                            device_hash: targetSocket.deviceHash,
                            reason: banReason,
                            severity,
                            expires_at: expiresAt
                        }]);
                    }

                    // Force Disconnect
                    targetSocket.disconnect(true);
                    log.warn(`Auto-Banned User ${targetSocket.id} [${severity}]`);

                    // Reset Reports after ban to avoid double-banning immediately upon return (if temp)
                    if (severity === 'level2') reportedUsers.delete(targetSocket.deviceHash);
                }
            };

            socket.on('report-user', ({ targetId, reason }) => {
                handleUserReport(socket, targetId, reason);
            });

            // ===== ENHANCED MATCHING SYSTEM =====

            // Track recent matches per user (avoid immediate re-matches)
            const recentMatches = new Map(); // socketId -> Set of recent partner IDs
            const RECENT_MATCH_LIMIT = 10; // Remember last 10 matches
            const RECENT_MATCH_COOLDOWN = 10 * 60 * 1000; // 10 minutes

            /**
             * Calculate match score between two users
             * Higher score = better match
             */
            const calculateMatchScore = (userSession, candidateSession, userReputation, candidateReputation) => {
                let score = 0;

                // 1. Reputation Compatibility (25 points)
                // Match users with similar reputation
                const repDiff = Math.abs(userReputation - candidateReputation);
                if (repDiff <= 2) score += 25;
                else if (repDiff <= 5) score += 15;
                else if (repDiff <= 10) score += 5;

                // 2. Wait Time Priority (20 points)
                // Users waiting longer get priority
                if (candidateSession.queueJoinedAt) {
                    const waitTime = Date.now() - new Date(candidateSession.queueJoinedAt).getTime();
                    const waitMinutes = waitTime / (60 * 1000);
                    score += Math.min(20, waitMinutes * 2); // Up to 20 points
                }

                // 3. Gender Preference Match (15 points)
                // Exact preference match gets full points
                const userGender = userSession.gender || 'any';
                const userPref = userSession.preferredGender || 'any';
                const candGender = candidateSession.gender || 'any';
                const candPref = candidateSession.preferredGender || 'any';

                const userSatisfied = userPref === 'any' || userPref === candGender;
                const candSatisfied = candPref === 'any' || candPref === userGender;

                if (userSatisfied && candSatisfied) score += 15;
                else if (userSatisfied || candSatisfied) score += 7;

                // 4. Avoid Recent Matches (40 points bonus for new match)
                // Heavily penalize recent matches
                const userRecent = recentMatches.get(userSession.socketId) || new Set();
                if (!userRecent.has(candidateSession.socketId)) {
                    score += 40;
                } else {
                    score -= 50; // Heavily penalize recent matches
                }

                // 5. Interest Matching (30 points) - if interests are provided
                if (userSession.interests && candidateSession.interests) {
                    const commonInterests = userSession.interests.filter(i =>
                        candidateSession.interests.includes(i)
                    );
                    score += commonInterests.length * 10; // 10 points per common interest
                }

                return score;
            };

            /**
             * Check if two users recently matched
             */
            const isRecentMatch = (socketId1, socketId2) => {
                const recent1 = recentMatches.get(socketId1) || new Set();
                const recent2 = recentMatches.get(socketId2) || new Set();
                return recent1.has(socketId2) || recent2.has(socketId1);
            };

            /**
             * Record a match to prevent immediate re-matching
             */
            const recordMatch = (socketId1, socketId2) => {
                // Add to each other's recent matches
                if (!recentMatches.has(socketId1)) recentMatches.set(socketId1, new Set());
                if (!recentMatches.has(socketId2)) recentMatches.set(socketId2, new Set());

                recentMatches.get(socketId1).add(socketId2);
                recentMatches.get(socketId2).add(socketId1);

                // Cleanup old entries (keep only last N)
                [socketId1, socketId2].forEach(id => {
                    const set = recentMatches.get(id);
                    if (set && set.size > RECENT_MATCH_LIMIT) {
                        const arr = Array.from(set);
                        recentMatches.set(id, new Set(arr.slice(-RECENT_MATCH_LIMIT)));
                    }
                });

                // Set cooldown cleanup
                setTimeout(() => {
                    const set1 = recentMatches.get(socketId1);
                    const set2 = recentMatches.get(socketId2);
                    if (set1) set1.delete(socketId2);
                    if (set2) set2.delete(socketId1);
                }, RECENT_MATCH_COOLDOWN);
            };

            // ===== PHASE 4: GENDER BALANCE OPTIMIZATION =====

            // Track queue distribution for balance optimization
            const queueDistribution = {
                male: 0,
                female: 0,
                any: 0
            };

            /**
             * Update queue distribution stats
             */
            const updateQueueDistribution = (gender, increment = true) => {
                const g = gender || 'any';
                if (queueDistribution[g] !== undefined) {
                    queueDistribution[g] += increment ? 1 : -1;
                    queueDistribution[g] = Math.max(0, queueDistribution[g]);
                }
            };

            /**
             * Check if preferences should be relaxed based on queue balance
             * Returns suggested preference or null if no change
             */
            const suggestPreferenceRelaxation = (userGender, userPreference, waitTime) => {
                const WAIT_THRESHOLD = 30000; // 30 seconds

                if (waitTime < WAIT_THRESHOLD) return null;

                // If waiting too long and queue is imbalanced, suggest "any"
                const total = queueDistribution.male + queueDistribution.female;
                if (total === 0) return null;

                const preferredCount = queueDistribution[userPreference] || 0;
                const ratio = preferredCount / total;

                // If less than 20% of queue matches preference, suggest relaxing
                if (ratio < 0.2 && userPreference !== 'any') {
                    log.info('Suggesting preference relaxation', {
                        user: userGender,
                        preferred: userPreference,
                        distribution: queueDistribution,
                        waitTime
                    });
                    return 'any';
                }

                return null;
            };

            /**
             * Get queue balance report
             */
            const getQueueBalance = () => {
                const total = queueDistribution.male + queueDistribution.female + queueDistribution.any;
                return {
                    distribution: { ...queueDistribution },
                    total,
                    malePercent: total > 0 ? Math.round((queueDistribution.male / total) * 100) : 0,
                    femalePercent: total > 0 ? Math.round((queueDistribution.female / total) * 100) : 0
                };
            };

            socket.on('join-queue', withRateLimit(async ({ language, gender, preferredGender, interests }) => {
                try {
                    if (!language || typeof language !== 'string') return;



                    const normalizedLang = language.toLowerCase();
                    const normalizedInterests = interests && Array.isArray(interests) ? interests : [];

                    // Language filter removed as per request
                    // const ALLOWED_LANGUAGES = [...]
                    // if (!ALLOWED_LANGUAGES.includes(normalizedLang)) { ... }

                    // Validate gender preferences (optional now)
                    // "male mostly look for female" -> Default 'male' looks for 'female'
                    // "female mostly look for the female" -> Default 'female' looks for 'female'

                    // Check if gender preferences are provided
                    const hasGenderPreference = gender && preferredGender;

                    let normalizedGender, normalizedPreferredGender;

                    if (hasGenderPreference) {
                        normalizedGender = gender.toLowerCase();

                        // Simple logic for "who I am and searching for":
                        let defaultPref = 'female'; // Default for everyone
                        if (normalizedGender === 'female') defaultPref = 'female'; // Explicitly mostly female

                        normalizedPreferredGender = (preferredGender || defaultPref).toLowerCase();

                        const ALLOWED_GENDERS = ['male', 'female', 'any'];
                        if (!ALLOWED_GENDERS.includes(normalizedGender) || !ALLOWED_GENDERS.includes(normalizedPreferredGender)) {
                            console.warn(`Blocked invalid gender request from ${socket.id}`);
                            socket.emit('error', 'Invalid gender selection');
                            return;
                        }
                    } else {
                        // No gender preference = Random matching (initial search)
                        normalizedGender = 'random';
                        normalizedPreferredGender = 'random';
                    }

                    // --- Reputation & Safety Checks ---
                    const userIp = getClientIp(socket);
                    const reputation = await reputationOps.get(userIp);
                    const isShadowBanned = reputation < 0;

                    // console.log to debug "who i'm and searching for"
                    console.log(`User ${socket.id} (Rep: ${reputation}, Shadow: ${isShadowBanned}) joining queue for ${normalizedLang} as ${normalizedGender} searching for ${normalizedPreferredGender}`);

                    // Clean up previous queue if exists
                    const existingSession = await sessionOps.get(socket.id);
                    if (existingSession && existingSession.inQueue) {
                        await queueOps.remove(
                            existingSession.language,
                            socket.id,
                            existingSession.gender || 'random',
                            existingSession.preferredGender || 'random',
                            existingSession.isShadowBanned
                        );
                        console.log(`Removed user from previous queue`);
                    }

                    // --- MATCHING LOGIC ---
                    let matchFound = false;
                    let peerSocketId = null;
                    let peerSession = null;

                    if (hasGenderPreference) {
                        // === GENDER-SPECIFIC MATCHING (Enhanced) ===
                        // Search multiple queues to find a compatible partner.
                        // We need to find a user who:
                        // 1. Matches MY preference (or I prefer 'any')
                        // 2. Is looking for MY gender (or they prefer 'any')

                        const potentialQueues = [];

                        // Determine compatible target genders
                        // If I prefer 'any', I can match with 'male' or 'female'
                        const targetGenders = (normalizedPreferredGender === 'any')
                            ? ['female', 'male']
                            : [normalizedPreferredGender];

                        // For each compatible target gender, check their queues
                        for (const targetGender of targetGenders) {
                            // Priority 1: They are looking for ME specifically (e.g. Female -> Male)
                            // Skip this check if I am 'any' gender (unless we treat 'any' as a specific category)
                            if (normalizedGender !== 'any') {
                                potentialQueues.push({
                                    gender: targetGender,
                                    preference: normalizedGender
                                });
                            }

                            // Priority 2: They are looking for ANY (e.g. Female -> Any)
                            potentialQueues.push({
                                gender: targetGender,
                                preference: 'any'
                            });
                        }

                        console.log(`[Gender Match] User (${normalizedGender}→${normalizedPreferredGender}) searching in ${potentialQueues.length} potential queues...`);

                        // Iterate through potential queues
                        for (const queue of potentialQueues) {
                            const targetQueueGender = queue.gender;
                            const targetQueuePreference = queue.preference;

                            console.log(`  -> Checking queue: ${normalizedLang}:${targetQueueGender}:${targetQueuePreference}:${isShadowBanned ? 'shadow' : 'normal'}`);

                            // Try to pop from this queue
                            // Loop purely for race-condition handling (pop might return null if snatched)
                            for (let attempts = 0; attempts < 3; attempts++) {
                                peerSocketId = await queueOps.pop(normalizedLang, targetQueueGender, targetQueuePreference, isShadowBanned);

                                if (!peerSocketId) break; // Queue empty

                                if (peerSocketId === socket.id) {
                                    // Popped myself? Put back and continue (should be rare if logic is correct)
                                    await queueOps.returnToFront(normalizedLang, socket.id, targetQueueGender, targetQueuePreference, isShadowBanned);
                                    continue;
                                }

                                peerSession = await sessionOps.get(peerSocketId);

                                if (!peerSession) {
                                    console.log(`Peer ${peerSocketId} stale, skipping`);
                                    continue;
                                }

                                // Double check Shadow Ban consistency
                                if (isShadowBanned !== peerSession.isShadowBanned) {
                                    // Put back
                                    await queueOps.returnToFront(normalizedLang, peerSocketId, targetQueueGender, targetQueuePreference, isShadowBanned);
                                    continue;
                                }

                                // Double check compatibility (Redundant if queues are correct, but safe)
                                const peerGender = peerSession.gender || 'random';
                                const peerPreferredGender = peerSession.preferredGender || 'random';

                                // Logic: 
                                // Do I satisfy them? (TheirPref == MyGender OR TheirPref == 'any')
                                // Do they satisfy me? (MyPref == TheirGender OR MyPref == 'any')
                                // Note: The queue selection already enforces this, but let's be sure.

                                // ENHANCED: Skip recent matches
                                if (isRecentMatch(socket.id, peerSocketId)) {
                                    log.debug('Skipping recent match', { user: socket.id, peer: peerSocketId });
                                    // Return peer to queue and try next
                                    await queueOps.returnToFront(normalizedLang, peerSocketId, peerGender, peerPreferredGender, isShadowBanned);
                                    continue;
                                }

                                matchFound = true;
                                break;
                            }

                            if (matchFound) break; // Stop checking other queues
                        }

                    } else {
                        // === RANDOM MATCHING (No Gender Filter) ===
                        // For initial search, match randomly from the language queue
                        console.log(`[Random Match] Searching in queue: ${normalizedLang}:random:random:${isShadowBanned ? 'shadow' : 'normal'}`);

                        for (let attempts = 0; attempts < 10; attempts++) {
                            peerSocketId = await queueOps.pop(normalizedLang, 'random', 'random', isShadowBanned);

                            if (!peerSocketId) {
                                break;
                            }

                            if (peerSocketId === socket.id) {
                                await queueOps.returnToFront(normalizedLang, socket.id, 'random', 'random', isShadowBanned);
                                continue;
                            }

                            peerSession = await sessionOps.get(peerSocketId);
                            if (!peerSession) {
                                console.log(`Peer ${peerSocketId} stale, skipping`);
                                continue;
                            }

                            if (isShadowBanned !== peerSession.isShadowBanned) {
                                console.warn(`Shadow mismatch: ${socket.id} (${isShadowBanned}) vs ${peerSocketId} (${peerSession.isShadowBanned})`);
                                continue;
                            }

                            // ENHANCED: Skip recent matches
                            if (isRecentMatch(socket.id, peerSocketId)) {
                                log.debug('Skipping recent match (random)', { user: socket.id, peer: peerSocketId });
                                await queueOps.returnToFront(normalizedLang, peerSocketId, 'random', 'random', isShadowBanned);
                                continue;
                            }

                            // For random matching, anyone in the queue is compatible
                            matchFound = true;
                            break;
                        }
                    }

                    if (matchFound && peerSocketId && peerSession) {
                        // Create match
                        const roomId = `${peerSocketId}#${socket.id}`;
                        const startTime = Date.now();
                        const peerGender = peerSession.gender || 'random';
                        const peerPreferredGender = peerSession.preferredGender || 'random';

                        // Set session data
                        await sessionOps.set(socket.id, {
                            roomId,
                            language: normalizedLang,
                            partnerSocketId: peerSocketId,
                            inQueue: false,
                            gender: normalizedGender,
                            preferredGender: normalizedPreferredGender,
                            isShadowBanned: isShadowBanned,
                            startTime: startTime
                        });
                        await sessionOps.set(peerSocketId, {
                            roomId,
                            language: normalizedLang,
                            partnerSocketId: socket.id,
                            inQueue: false,
                            gender: peerGender,
                            preferredGender: peerPreferredGender,
                            isShadowBanned: peerSession.isShadowBanned,
                            startTime: startTime
                        });

                        socket.join(roomId);
                        io.in(peerSocketId).socketsJoin(roomId);

                        // Send Partner Gender info for better connection context
                        io.to(socket.id).emit('match-found', {
                            roomId,
                            initiator: socket.id,
                            partnerId: peerSocketId,
                            partnerGender: peerGender
                        });
                        io.to(peerSocketId).emit('match-found', {
                            roomId,
                            initiator: socket.id,
                            partnerId: socket.id,
                            partnerGender: normalizedGender
                        });

                        const matchType = hasGenderPreference ? 'Gender-Specific' : 'Random';
                        log.info(`${matchType} Match completed`, { user1: socket.id, user2: peerSocketId, room: roomId, shadow: isShadowBanned });
                        stats.totalMatches++;
                        matchesCounter.inc();
                        activeRoomsGauge.inc();

                        // Record this match to prevent immediate re-matching
                        recordMatch(socket.id, peerSocketId);

                        // Decrement queue distribution for both users
                        updateQueueDistribution(normalizedGender, false);
                        updateQueueDistribution(peerGender, false);
                    }

                    if (!matchFound) {
                        // No match found, add to queue with Weighted Score
                        await queueOps.pushWithScore(normalizedLang, socket.id, normalizedGender, normalizedPreferredGender, isShadowBanned, reputation);

                        await sessionOps.set(socket.id, {
                            socketId: socket.id, // For scoring function
                            inQueue: true,
                            language: normalizedLang,
                            gender: normalizedGender,
                            preferredGender: normalizedPreferredGender,
                            isShadowBanned: isShadowBanned,
                            queueJoinedAt: new Date().toISOString(), // Track when they joined queue
                            interests: normalizedInterests // For interest-based matching
                        });
                        log.info('User added to queue', { socketId: socket.id, language: normalizedLang, gender: normalizedGender, preferred: normalizedPreferredGender });
                        usersInQueueGauge.inc();

                        // Track queue distribution for balance optimization
                        updateQueueDistribution(normalizedGender, true);

                        // Log queue balance for monitoring
                        const balance = getQueueBalance();
                        log.debug('Queue balance', balance);

                        // Update active connection tracking for dashboard
                        const connData = activeConnections.get(socket.id);
                        if (connData) {
                            connData.inQueue = true;
                            connData.gender = normalizedGender;
                            connData.preferredGender = normalizedPreferredGender;
                            connData.queueJoinedAt = new Date().toISOString();
                        }
                    }
                } catch (e) {
                    log.error('Error in join-queue', { error: e.message });
                }
            }));

            // Signaling events
            // A01: Broken Access Control - Verify Signaling Partner
            const validateSignal = async (socket, targetId) => {
                const session = await sessionOps.get(socket.id);
                if (!session || session.partnerSocketId !== targetId) {
                    console.warn(`Blocked unauthorized signal from ${socket.id} to ${targetId}`);
                    return false;
                }
                return true;
            };

            socket.on('offer', withRateLimit(async (payload) => {
                if (await validateSignal(socket, payload.target)) {
                    socket.to(payload.target).emit('offer', payload);
                }
            }));

            socket.on('answer', withRateLimit(async (payload) => {
                if (await validateSignal(socket, payload.target)) {
                    socket.to(payload.target).emit('answer', payload);
                }
            }));

            socket.on('ice-candidate', withRateLimit(async (payload) => {
                if (await validateSignal(socket, payload.target)) {
                    socket.to(payload.target).emit('ice-candidate', payload);
                }
            }));

            socket.on('send-message', withRateLimit(({ roomId, message }) => {
                // Deprecated: Client uses WebRTC Data Channel for E2EE text now.
                // Keeping this logic dormant or for legacy fallback if P2P fails (optional).
                // To enforce strict E2EE, we can just log a warning or return.

                // console.warn(`Legacy message attempt from ${socket.id}`);
                // return;

                // Existing logic (inactive if client doesn't emit)
                if (!message || typeof message !== 'string' || message.length > 1000) return;
                if (!socket.rooms.has(roomId)) return;
                const sanitizedMessage = xss(message);
                socket.to(roomId).emit('receive-message', { message: sanitizedMessage, sender: 'partner' });
            }));

            socket.on('report-user', withRateLimit(async ({ targetId, reason }) => {
                const session = await sessionOps.get(socket.id);
                if (!session || session.partnerSocketId !== targetId) return;

                console.log(`Report received: ${socket.id} reported ${targetId} for ${reason}`);

                // Get target IP (we need to look up socket if possible, or store IP in session)
                // Since we don't store IP in session, we can't easily punish offline users without architectural changes.
                // However, if they are online, we can get their socket.
                const targetSocket = io.sockets.sockets.get(targetId);
                if (targetSocket) {
                    const targetIp = getClientIp(targetSocket);
                    await reputationOps.update(targetIp, -50);
                    console.log(`Reputation penalized for ${targetId} (${targetIp})`);
                } else {
                    // TODO: Persist IP in session for offline reporting
                    console.warn("Target socket not found, cannot penalize reputation immediately.");
                }
            }));

            // --- Warning System ---
            socket.on('nsfw_warning', withRateLimit(async () => {
                const ip = getClientIp(socket);
                const deviceHash = socket.handshake.auth.deviceHash;
                const reason = 'NSFW Warning (First Strike)';
                const severity = 'warning';

                console.warn(`[NSFW WARNING] User ${socket.id} (IP: ${ip}) flagged.`);

                // Cache Warning
                if (ip) blockedUsersCache.set(ip, { reason, severity, expiresAt: null, type: 'ip' });
                if (deviceHash) blockedUsersCache.set(deviceHash, { reason, severity, expiresAt: null, type: 'device' });

                // Persist Warning
                if (supabase) {
                    const bans = [];
                    if (ip) bans.push({ ip, reason, severity, expires_at: null });
                    if (deviceHash) bans.push({ device_hash: deviceHash, reason, severity, expires_at: null });
                    await supabase.from('blocked_users').insert(bans).then(({ error }) => {
                        if (error) console.error('Supabase warning insert error:', error);
                    });
                }
            }));

            // --- NSFW Enforcement ---
            socket.on('nsfw_detected', withRateLimit(async () => {
                const ip = getClientIp(socket);
                const deviceHash = socket.handshake.auth.deviceHash;

                console.warn(`[NSFW DETECTED] User ${socket.id} (IP: ${ip}) emitted self-violation.`);

                // 1. Log to Database (as a self-report/auto-ban)
                const reason = 'NSFW Content Detected (Auto-Moderation)';
                const severity = 'level2'; // Permanent Ban

                // 2. Add to Cache
                if (ip) blockedUsersCache.set(ip, { reason, severity, expiresAt: null, type: 'ip' });
                if (deviceHash) blockedUsersCache.set(deviceHash, { reason, severity, expiresAt: null, type: 'device' });

                // 3. Persist to Supabase
                if (supabase) {
                    const bans = [];
                    if (ip) bans.push({ ip, reason, severity, expires_at: null });
                    if (deviceHash) bans.push({ device_hash: deviceHash, reason, severity, expires_at: null });

                    if (bans.length > 0) {
                        try {
                            const { error } = await supabase.from('blocked_users').insert(bans);
                            if (error) console.error('Supabase ban insert error:', error);
                        } catch (err) {
                            console.error('Supabase error:', err);
                        }
                    }
                }

                // 4. Terminate Connection
                socket.emit('banned', { reason: 'Inappropriate content detected.' });
                socket.disconnect(true);
            }));

            socket.on('disconnect', async () => {
                // Update metrics
                const currentUsers = io.engine.clientsCount || 0;
                activeUsersGauge.set(currentUsers);

                log.info('User disconnected', { socketId: socket.id });
                socketRateLimits.delete(socket.id); // Valid cleanup
                activeConnections.delete(socket.id); // Remove from active tracking
                const session = await sessionOps.get(socket.id);

                if (session) {
                    // REPUTATION CHECK (End of Call)
                    if (session.startTime && session.partnerSocketId) {
                        const duration = Date.now() - session.startTime;
                        // Log match history on disconnect
                        const partnerSocket = io.sockets.sockets.get(session.partnerSocketId);
                        logMatch(socket, partnerSocket, duration, 'disconnect'); // User, Partner, Duration, Reason

                        if (duration > 60000) { // 1 Minute
                            const ip = getClientIp(socket);
                            await reputationOps.update(ip, 2);
                            log.debug(`Reputation bumped for ${socket.id} (Chat: ${Math.floor(duration / 1000)}s)`);
                        }
                    }

                    if (session.inQueue) {
                        await queueOps.remove(
                            session.language,
                            socket.id,
                            session.gender || 'male',
                            session.preferredGender || 'female',
                            session.isShadowBanned
                        );
                        log.debug(`Removed ${socket.id} from ${session.language} queue`);
                        usersInQueueGauge.dec();
                        // Decrement queue distribution
                        updateQueueDistribution(session.gender || 'any', false);
                    } else if (session.roomId) {
                        socket.to(session.roomId).emit('partner-disconnected');
                        activeRoomsGauge.dec();
                    }
                    await sessionOps.delete(socket.id);
                }
            });

            socket.on('leave-room', async () => {
                const session = await sessionOps.get(socket.id);
                if (session && session.roomId) {
                    // REPUTATION CHECK (End of Call)
                    if (session.startTime) {
                        const duration = Date.now() - session.startTime;
                        // Log match history
                        const partnerSocket = io.sockets.sockets.get(session.partnerSocketId);
                        logMatch(socket, partnerSocket, duration, 'left-room');

                        if (duration > 60000) { // 1 Minute
                            const ip = getClientIp(socket);
                            await reputationOps.update(ip, 2);
                            console.log(`Reputation bumped for ${socket.id} (Chat: ${Math.floor(duration / 1000)}s)`);
                        }
                    }

                    socket.to(session.roomId).emit('partner-disconnected');
                    socket.leave(session.roomId);
                    await sessionOps.delete(socket.id);
                }
            });
        });

        // --- Start Listener ---
        const PORT = process.env.PORT || 5000;
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`Worker ${process.pid} running on port ${PORT}`);
            if (!useRedis) console.log('ℹ️  Running in In-Memory Mode');
        });
    };

    // Start everything
    startServer();
}