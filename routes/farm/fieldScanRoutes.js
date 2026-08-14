const router = require('express').Router();
const {
    startFieldScan,
    analyzeFieldScan,
    getFieldScanSettings,
    getMyFieldScans,
} = require('../../controllers/farm/fieldScanController');
const farmerAuth = require('../../middleware/farm/auth');

router.use(farmerAuth);

router.post('/start', startFieldScan);
router.post('/analyze', analyzeFieldScan);
router.get('/settings', getFieldScanSettings);
router.get('/my-scans', getMyFieldScans);

module.exports = router;