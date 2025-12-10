const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const cluster = require('cluster');
const os = require('os');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss');
require('dotenv').config();

require('dotenv').config();

const numCPUs = process.env.WEB_CONCURRENCY || 1; // Default to 1 worker for free/shared tiers to avoid OOM

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

    let server;

    // Production: Use HTTP (cloud platforms handle SSL termination)
    // Development: Use HTTP to avoid certificate trust issues
    server = http.createServer(app);

    if (process.env.NODE_ENV === 'production') {
        console.log('🔒 Production mode: HTTP (SSL handled by load balancer)');
    } else {
        console.log('🌐 Development mode: HTTP (no SSL certificates needed)');
    }

    const io = new Server(server, {
        cors: {
            // A05: Security Misconfiguration - Restrict CORS
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin) return callback(null, true);

                // Allow localhost and local network IPs (http and https)
                if (origin.startsWith('http://localhost') ||
                    origin.startsWith('https://localhost') ||
                    origin.startsWith('http://192.168.') ||
                    origin.startsWith('https://192.168.') ||
                    origin.startsWith('http://127.0.0.1') ||
                    origin.startsWith('https://127.0.0.1') ||
                    origin.endsWith('.vercel.app')) { // Allow Vercel deployments
                    return callback(null, true);
                }

                return callback(new Error('Not allowed by CORS'));
            },
            methods: ["GET", "POST"]
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling']
    });

    // Redis setup & Fallback
    let redisConfig;
    let pubClient, subClient, dbClient;
    let useRedis = false;

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
                const tempPub = createClient(redisConfig);
                const tempSub = tempPub.duplicate();
                const tempDb = createClient(redisConfig);

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

        // Helper to get queue key
        const getQueueKey = (lang) => `queue:${lang}`;
        const getSessionKey = (socketId) => `session:${socketId}`;

        const queueOps = {
            push: async (lang, socketId) => {
                await dbClient.zAdd(getQueueKey(lang), { score: Date.now(), value: socketId });
            },
            pop: async (lang) => {
                const result = await dbClient.zPopMin(getQueueKey(lang));
                return result ? result.value : null;
            },
            returnToFront: async (lang, socketId) => {
                await dbClient.zAdd(getQueueKey(lang), { score: 0, value: socketId });
            },
            remove: async (lang, socketId) => {
                await dbClient.zRem(getQueueKey(lang), socketId);
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
                if (data.inQueue === 'true') data.inQueue = true;
                if (data.inQueue === 'false') data.inQueue = false;
                return data;
            },
            delete: async (socketId) => {
                await dbClient.del(getSessionKey(socketId));
            }
        };

        // --- Socket Logic ---

        io.on('connection', (socket) => {
            console.log('User connected:', socket.id);

            socket.on('join-queue', async ({ language }) => {
                try {
                    if (!language || typeof language !== 'string') return;

                    const normalizedLang = language.toLowerCase();
                    const ALLOWED_LANGUAGES = [
                        'english', 'spanish', 'french', 'german', 'portuguese', 'russian',
                        'hindi', 'bengali', 'marathi', 'telugu', 'tamil', 'urdu',
                        'japanese', 'chinese', 'arabic', 'indonesian',
                        'gujarati', 'kannada', 'malayalam', 'punjabi', 'odia', 'assamese'
                    ];

                    // A03: Injection Prevention - Strict Allowlist
                    if (!ALLOWED_LANGUAGES.includes(normalizedLang)) {
                        console.warn(`Blocked invalid language request: ${normalizedLang} from ${socket.id}`);
                        socket.emit('error', 'Invalid language selection');
                        return;
                    }

                    console.log(`User ${socket.id} joining queue for ${normalizedLang}`);

                    let matchFound = false;
                    while (!matchFound) {
                        const peerSocketId = await queueOps.pop(normalizedLang);

                        if (!peerSocketId) {
                            // Queue empty, wait
                            await queueOps.push(normalizedLang, socket.id);
                            await sessionOps.set(socket.id, { inQueue: true, language: normalizedLang });
                            console.log(`User ${socket.id} added to ${normalizedLang} queue`);
                            break;
                        }

                        if (peerSocketId === socket.id) {
                            // Matched self (shouldn't happen often but possible if re-joining fast), push back
                            await queueOps.returnToFront(normalizedLang, socket.id);
                            // Just break to wait for someone else
                            await sessionOps.set(socket.id, { inQueue: true, language: normalizedLang });
                            break;
                        }

                        const peerSession = await sessionOps.get(peerSocketId);

                        if (!peerSession) {
                            console.log(`Peer ${peerSocketId} stale (no session), removing and trying next`);
                            // Loop continues to next peer
                            continue;
                        }

                        // Found valid peer
                        matchFound = true;
                        const roomId = `${peerSocketId}#${socket.id}`;

                        // Set session data
                        await sessionOps.set(socket.id, { roomId, language: normalizedLang, partnerSocketId: peerSocketId, inQueue: false });
                        await sessionOps.set(peerSocketId, { roomId, language: normalizedLang, partnerSocketId: socket.id, inQueue: false });

                        socket.join(roomId); // Local
                        // Remote join (if Redis adapter) or local
                        // If using Redis adapter, we need to use special method or assume sockets are on same node if not sharded
                        // With io.in(peerSocketId).socketsJoin(roomId), it works across nodes if adapter is set
                        io.in(peerSocketId).socketsJoin(roomId);

                        io.to(socket.id).emit('match-found', { roomId, initiator: socket.id, partnerId: peerSocketId });
                        io.to(peerSocketId).emit('match-found', { roomId, initiator: socket.id, partnerId: socket.id });

                        console.log(`Match made: ${socket.id} & ${peerSocketId} in room ${roomId}`);
                    }
                } catch (e) {
                    console.error('Error in join-queue:', e);
                }
            });

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

            socket.on('offer', async (payload) => {
                if (await validateSignal(socket, payload.target)) {
                    socket.to(payload.target).emit('offer', payload);
                }
            });

            socket.on('answer', async (payload) => {
                if (await validateSignal(socket, payload.target)) {
                    socket.to(payload.target).emit('answer', payload);
                }
            });

            socket.on('ice-candidate', async (payload) => {
                if (await validateSignal(socket, payload.target)) {
                    socket.to(payload.target).emit('ice-candidate', payload);
                }
            });

            socket.on('send-message', ({ roomId, message }) => {
                // A03: Injection Prevention - Input Validation & Sanitization
                if (!message || typeof message !== 'string' || message.length > 1000) {
                    console.warn(`Blocked invalid/long message from ${socket.id}`);
                    return;
                }

                if (!socket.rooms.has(roomId)) {
                    console.warn(`Blocked unauthorized message to ${roomId} from ${socket.id}`);
                    return;
                }

                // Sanitize XSS
                const sanitizedMessage = xss(message);

                socket.to(roomId).emit('receive-message', { message: sanitizedMessage, sender: 'partner' });
            });

            socket.on('disconnect', async () => {
                console.log('User disconnected:', socket.id);
                const session = await sessionOps.get(socket.id);

                if (session) {
                    if (session.inQueue) {
                        await queueOps.remove(session.language, socket.id);
                        console.log(`Removed ${socket.id} from ${session.language} queue`);
                    } else if (session.roomId) {
                        socket.to(session.roomId).emit('partner-disconnected');
                    }
                    await sessionOps.delete(socket.id);
                }
            });

            socket.on('leave-room', async () => {
                const session = await sessionOps.get(socket.id);
                if (session && session.roomId) {
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