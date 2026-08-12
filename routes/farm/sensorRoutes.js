const router = require('express').Router();
const { receiveSensorData, getFieldReadings, getDeviceReadings } = require('../../controllers/farm/sensorController');
const farmerAuth = require('../../middleware/farm/auth');

router.post('/data', receiveSensorData);

router.use(farmerAuth);

router.get('/field/:fieldId', getFieldReadings);
router.get('/device/:deviceId', getDeviceReadings);

module.exports = router;