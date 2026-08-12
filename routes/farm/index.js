const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/farms', require('./farmRoutes'));
router.use('/fields', require('./fieldRoutes'));
router.use('/crops', require('./cropRoutes'));
router.use('/devices', require('./deviceRoutes'));
router.use('/sensors', require('./sensorRoutes'));
router.use('/images', require('./imageRoutes'));
router.use('/alerts', require('./alertRoutes'));
router.use('/chat', require('./chatRoutes'));
router.use('/animals', require('./animalRoutes'));
router.use('/health', require('./healthRoutes'));
router.use('/production', require('./productionRoutes'));
router.use('/inventory', require('./inventoryRoutes'));
router.use('/equipment', require('./equipmentRoutes'));
router.use('/transactions', require('./transactionRoutes'));
router.use('/prices', require('./productPriceRoutes'));
router.use('/team', require('./teamRoutes'));
router.use('/tasks', require('./taskRoutes'));
router.use('/weather', require('./weatherRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/stock', require('./stockRoutes'));

module.exports = router;