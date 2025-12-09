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

const numCPUs = os.cpus().length;

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
        max: 1000, // Scalability: Increased for NAT/Proxy users
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
                    origin.startsWith('https://127.0.0.1')) {
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

    // Redis setup
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    const redisClient = createClient({ url: redisUrl }); // Using a dedicated client for commands might be cleaner or just use pubClient if not blocked? 
    // Actually, pub/sub clients enter subscriber mode, so we need a regular client for commands like lpush/hset.
    // pubClient can be used for publishing, but subClient is strictly for subscribing.
    // To be safe and standard, let's keep a general 'dbClient' for data ops.
    const dbClient = createClient({ url: redisUrl });

    (async () => {
        try {
            await Promise.all([pubClient.connect(), subClient.connect(), dbClient.connect()]);
            io.adapter(createAdapter(pubClient, subClient));
            console.log('Connected to Redis and set up Socket.io Adapter');
        } catch (e) {
            console.error('Redis connection failed:', e);
            process.exit(1); // Cannot run scalable mode without Redis
        }
    })();

    dbClient.on('error', (err) => console.log('Redis DB Client Error', err));

    // Helper to get queue key
    const getQueueKey = (lang) => `queue:${lang}`;
    const getSessionKey = (socketId) => `session:${socketId}`;

    // Queue Abstraction - Redis ZSET (O(log N))
    const queueOps = {
        push: async (lang, socketId) => {
            // Score = timestamp (FIFO behavior naturally)
            await dbClient.zAdd(getQueueKey(lang), { score: Date.now(), value: socketId });
        },
        pop: async (lang) => {
            // Pop element with lowest score (oldest)
            const result = await dbClient.zPopMin(getQueueKey(lang));
            return result ? result.value : null;
        },
        returnToFront: async (lang, socketId) => {
            // Score = 0 to be popped first
            await dbClient.zAdd(getQueueKey(lang), { score: 0, value: socketId });
        },
        remove: async (lang, socketId) => {
            await dbClient.zRem(getQueueKey(lang), socketId);
        }
    };

    // Session Abstraction - Redis Only
    const sessionOps = {
        set: async (socketId, data) => {
            // Flatten object for HSET if needed, but Redis handles flat maps. 
            // We'll store fields: roomId, language, partnerSocketId, inQueue
            // Note: data values should be strings.
            const flatData = {};
            for (const [k, v] of Object.entries(data)) {
                flatData[k] = String(v);
            }
            await dbClient.hSet(getSessionKey(socketId), flatData);
            // Set expiry to avoid stale keys if restart happens (e.g., 24h)
            await dbClient.expire(getSessionKey(socketId), 86400);
        },
        get: async (socketId) => {
            const data = await dbClient.hGetAll(getSessionKey(socketId));
            if (!data || Object.keys(data).length === 0) return null;
            // Convert 'true'/'false' strings back to booleans if needed
            if (data.inQueue === 'true') data.inQueue = true;
            if (data.inQueue === 'false') data.inQueue = false;
            return data;
        },
        delete: async (socketId) => {
            await dbClient.del(getSessionKey(socketId));
        }
    };


    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        socket.on('join-queue', async ({ language }) => {
            try {
                if (!language || typeof language !== 'string') return;

                const normalizedLang = language.toLowerCase();
                const ALLOWED_LANGUAGES = ['english', 'spanish', 'french', 'german', 'portuguese', 'russian'];

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
                    io.in(peerSocketId).socketsJoin(roomId); // Remote or Local

                    io.to(socket.id).emit('match-found', { roomId, initiator: socket.id });
                    io.to(peerSocketId).emit('match-found', { roomId, initiator: socket.id });

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

            // A01: Broken Access Control - Verify Room Membership
            // socket.rooms is a Set containing the socket ID and any rooms joined.
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
                    // Cleanup partner session data?
                    // The partner is still online, but the "call" is over.
                    // We might want to keep the partner's session active but remove the roomId link?
                    // For now, minimal changes to logic: just notify.
                }
                await sessionOps.delete(socket.id);
            }
        });

        socket.on('leave-room', async () => {
            const session = await sessionOps.get(socket.id);
            if (session && session.roomId) {
                socket.to(session.roomId).emit('partner-disconnected');
                socket.leave(session.roomId);

                // Clean up session logic. Ideally, we shouldn't delete the session if we want them to rejoin queue immediately
                // But for now, let's just clear the 'roomId' and 'partnerSocketId' fields or delete the whole session 
                // and let them reconnect/re-establish?
                // The client architecture seems to be: join-queue -> match.
                // If they leave room, they might go back to home.
                await sessionOps.delete(socket.id);
            }
        });
    });

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Worker ${process.pid} running on port ${PORT}`);
    });
}

