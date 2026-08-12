const { Server } = require('socket.io');

let io = null;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
            methods: ['GET', 'POST'],
            credentials: true,
        },
        pingTimeout: 60000,
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.id}`);

        socket.on('join-farm', (farmId) => {
            socket.join(`farm:${farmId}`);
            console.log(`Socket ${socket.id} joined farm:${farmId}`);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

const getIO = () => io;

module.exports = { initSocket, getIO };