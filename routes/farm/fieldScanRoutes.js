const router = require('express').Router();
const {
    startFieldScan,
    analyzeFieldScan,
    getFieldScanSettings,
    getMyFieldScans,
    getFieldScanById,
    getFieldScansByField,
    deleteFieldScan,
} = require('../../controllers/farm/fieldScanController');
const farmerAuth = require('../../middleware/farm/auth');

router.use(farmerAuth);

router.post('/start', startFieldScan);
router.post('/analyze', analyzeFieldScan);
router.get('/settings', getFieldScanSettings);
router.get('/my-scans', getMyFieldScans);
router.get('/field/:fieldId', getFieldScansByField);
router.get('/:id', getFieldScanById);
router.delete('/:id', deleteFieldScan);

module.exports = router;