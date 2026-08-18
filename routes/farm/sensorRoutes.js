const router = require('express').Router();
const { receiveSensorData, getFieldReadings, getDeviceReadings } = require('../../controllers/farm/sensorController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { planCheck } = require('../../middleware/farm/planCheck');

router.post('/data', receiveSensorData);

router.use(farmerAuth);
router.use(subscriptionCheck);

router.get('/field/:fieldId', planCheck('iot_field_sensors'), getFieldReadings);
router.get('/device/:deviceId', planCheck('iot_field_sensors'), getDeviceReadings);

module.exports = router;