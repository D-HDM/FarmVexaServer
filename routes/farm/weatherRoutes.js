const router = require('express').Router();
const { getFarmWeather, refreshWeather } = require('../../controllers/farm/weatherController');
const farmerAuth = require('../../middleware/farm/auth');
const { ownsFarm } = require('../../middleware/farm/farm');

router.use(farmerAuth);
router.get('/farm/:farmId', ownsFarm, getFarmWeather);
router.post('/farm/:farmId/refresh', ownsFarm, refreshWeather);

module.exports = router;