const router = require('express').Router();
const {
    listBackups, createBackup, uploadBackup, restoreBackup,
    downloadBackup, sendBackupEmail, deleteBackup,
    getSettings, updateSettings,
} = require('../../controllers/admin/backupController');
const adminAuth = require('../../middleware/admin/adminAuth');
const upload = require('../../middleware/global/upload');

router.use(adminAuth);

router.get('/', listBackups);
router.post('/create', createBackup);
router.post('/upload', upload.single('backupFile'), uploadBackup);
router.post('/:id/restore', restoreBackup);
router.get('/:id/download', downloadBackup);
router.post('/:id/email', sendBackupEmail);
router.delete('/:id', deleteBackup);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

module.exports = router;