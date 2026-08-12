const express = require('express');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const env = require('./config/env');
const { startSchedulers } = require('./schedulers');
const errorHandler = require('./middleware/global/errorHandler');
const requestLogger = require('./middleware/global/requestLogger');
const corsMiddleware = require('./middleware/global/cors');
const { generalLimiter } = require('./middleware/global/rateLimiter');
const routes = require('./routes');
const logger = require('./utils/logger');

connectDB();
connectRedis();

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(corsMiddleware);
app.use(generalLimiter);
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => res.json({ success: true, service: 'FarmVexa API', version: '1.0.0', environment: env.nodeEnv }));
app.get('/api', (req, res) => res.json({ success: true, service: 'FarmVexa API', version: '1.0.0', endpoints: { health: '/api/health', admin: '/api/admin', farm: '/api/farm' } }));
app.get('/api/health', (req, res) => {
    const mongoose = require('mongoose');
    res.json({ success: true, status: 'healthy', uptime: process.uptime(), mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', timestamp: new Date().toISOString() });
});

app.use('/api', routes);
app.use(errorHandler);

const PORT = env.port;
const server = app.listen(PORT, () => {
    console.log(`\x1b[36m🚀 FarmVexa Server\x1b[0m → Port ${PORT} [${env.nodeEnv}]`);
    console.log(`\x1b[32m🔗 API:\x1b[0m ${env.apiUrl}`);
    console.log(`\x1b[32m🧠 AI:\x1b[0m ${env.pythonAiUrl}`);
    startSchedulers();
});

const { initSocket } = require('./config/socket');
initSocket(server);

const shutdown = async (signal) => {
    console.log(`\x1b[33m${signal} received. Shutting down...\x1b[0m`);
    const { stopSchedulers } = require('./schedulers'); stopSchedulers();
    const mongoose = require('mongoose'); await mongoose.connection.close();
    const { getRedis } = require('./config/redis'); const redis = getRedis(); if (redis) await redis.quit();
    server.close(() => { console.log('\x1b[32mServer closed\x1b[0m'); process.exit(0); });
    setTimeout(() => { console.error('\x1b[31mForced shutdown\x1b[0m'); process.exit(1); }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => { logger.error(`Unhandled Rejection: ${err.message}`); server.close(() => process.exit(1)); });
process.on('uncaughtException', (err) => { logger.error(`Uncaught Exception: ${err.message}`); process.exit(1); });