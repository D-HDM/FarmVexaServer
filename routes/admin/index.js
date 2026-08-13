const express = require('express');
const router = express.Router();

router.use('/auth', require('./adminRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/approvals', require('./approvalRoutes'));
router.use('/farms', require('./farmManagementRoutes'));
router.use('/settings', require('./settingsRoutes'));
router.use('/health', require('./healthRoutes'));
router.use('/usage', require('./usageRoutes'));
router.use('/models', require('./modelRoutes'));
router.use('/public', require('./publicRoutes'));
router.use('/payment-methods', require('./paymentMethodsRoutes'));
router.use('/payment-models', require('./paymentModelsRoutes'));
router.use('/weather-test', require('./weatherTestRoutes'));
router.use('/backups', require('./backupRoutes'));
router.use('/market', require('./marketRoutes'));

module.exports = router;