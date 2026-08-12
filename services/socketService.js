const { getIO } = require('../config/socket');

const emitSensorUpdate = (farmId, data) => {
    const io = getIO();
    if (io) {
        io.to(`farm:${farmId}`).emit('sensorUpdate', data);
    }
};

const emitNewAlert = (farmId, alert) => {
    const io = getIO();
    if (io) {
        io.to(`farm:${farmId}`).emit('newAlert', alert);
    }
};

const emitDeviceStatus = (farmId, device) => {
    const io = getIO();
    if (io) {
        io.to(`farm:${farmId}`).emit('deviceStatus', device);
    }
};

module.exports = { emitSensorUpdate, emitNewAlert, emitDeviceStatus };