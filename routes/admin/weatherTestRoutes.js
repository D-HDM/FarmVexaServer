const router = require('express').Router();
const { runWeatherTest, getWeatherTestResults } = require('../../controllers/admin/weatherTestController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/', getWeatherTestResults);
router.post('/run', runWeatherTest);

module.exports = router;