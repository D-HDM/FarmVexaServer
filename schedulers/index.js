const cron = require('node-cron');
const sensorCheckScheduler = require('./sensorCheckScheduler');
const alertScheduler = require('./alertScheduler');
const reportScheduler = require('./reportScheduler');
const deviceHealthScheduler = require('./deviceHealthScheduler');
const dataCleanupScheduler = require('./dataCleanupScheduler');
const dailyBriefingScheduler = require('./dailyBriefingScheduler');
const reminderScheduler = require('./reminderScheduler');
const backupScheduler = require('./backupScheduler');
const subscriptionScheduler = require('./subscriptionScheduler');
const virtualDeviceScheduler = require('./virtualDeviceScheduler');
const logger = require('../utils/logger');


const startSchedulers = () => {
    logger.info('📅 Starting schedulers...');
    sensorCheckScheduler.start();
    alertScheduler.start();
    reportScheduler.start();
    deviceHealthScheduler.start();
    dataCleanupScheduler.start();
    dailyBriefingScheduler.start();
    reminderScheduler.start();
    backupScheduler.start();
    subscriptionScheduler.start();
    virtualDeviceScheduler.start();
    logger.info('✅ All schedulers started');
};

const stopSchedulers = () => {
    sensorCheckScheduler.stop();
    alertScheduler.stop();
    reportScheduler.stop();
    deviceHealthScheduler.stop();
    dataCleanupScheduler.stop();
    dailyBriefingScheduler.stop();
    reminderScheduler.stop();
    backupScheduler.stop();
    subscriptionScheduler.stop();
    virtualDeviceScheduler.stop();
    logger.info('🛑 All schedulers stopped');
};

module.exports = { startSchedulers, stopSchedulers };