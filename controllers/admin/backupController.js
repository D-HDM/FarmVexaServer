const backupService = require('../../services/backupService');
const emailService = require('../../services/emailService');
const Settings = require('../../models/admin/Settings');
const path = require('path');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const listBackups = asyncHandler(async (req, res) => {
    const backups = await backupService.listBackups();
    return successResponse(res, { backups });
});

const createBackup = asyncHandler(async (req, res) => {
    const backup = await backupService.createBackup(req.user.id);
    return successResponse(res, { backup }, 'Backup created successfully');
});

const uploadBackup = asyncHandler(async (req, res) => {
    if (!req.file) return errorResponse(res, 'No file uploaded', 400);
    
    const fs = require('fs');
    const path = require('path');
    const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
    
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    
    const destPath = path.join(BACKUP_DIR, req.file.originalname);
    fs.copyFileSync(req.file.path, destPath);
    
    const stats = fs.statSync(destPath);
    const backup = await require('../../models/admin/Backup').create({
        filename: req.file.originalname,
        size: stats.size,
        status: 'uploaded',
        createdBy: req.user.id,
    });
    
    return successResponse(res, { backup }, 'Backup uploaded');
});

const restoreBackup = asyncHandler(async (req, res) => {
    const backup = await backupService.getBackup(req.params.id);
    if (!backup) return errorResponse(res, 'Backup not found', 404);
    
    const metadata = await backupService.restoreBackup(backup.filename);
    return successResponse(res, { metadata }, 'Backup restored successfully');
});

const downloadBackup = asyncHandler(async (req, res) => {
    const backup = await backupService.getBackup(req.params.id);
    if (!backup) return errorResponse(res, 'Backup not found', 404);
    
    const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
    const filePath = path.join(BACKUP_DIR, backup.filename);
    
    if (!require('fs').existsSync(filePath)) return errorResponse(res, 'File not found', 404);
    
    res.download(filePath, backup.filename);
});

const sendBackupEmail = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) return errorResponse(res, 'Email required', 400);
    
    const backup = await backupService.getBackup(req.params.id);
    if (!backup) return errorResponse(res, 'Backup not found', 404);
    
    const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
    const filePath = path.join(BACKUP_DIR, backup.filename);
    
    const fs = require('fs');
    const attachment = fs.readFileSync(filePath);
    
    // Simple email with attachment
    const { sendEmail } = require('../../config/hdmBridge');
    await sendEmail(email, 'FarmVexa Backup', `<p>Please find attached your FarmVexa backup: <strong>${backup.filename}</strong></p>`);
    
    return successResponse(res, null, 'Backup email sent');
});

const deleteBackup = asyncHandler(async (req, res) => {
    await backupService.deleteBackup(req.params.id);
    return successResponse(res, null, 'Backup deleted');
});

const getSettings = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    return successResponse(res, {
        autoBackup: settings?.system?.autoBackup || false,
        backupFrequency: settings?.system?.backupFrequency || 'daily',
        backupEmail: settings?.system?.backupEmail || '',
        sendBackupEmail: settings?.system?.sendBackupEmail || false,
    });
});

const updateSettings = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    if (!settings) return errorResponse(res, 'Settings not found', 404);
    
    if (req.body.autoBackup !== undefined) settings.system.autoBackup = req.body.autoBackup;
    if (req.body.backupFrequency) settings.system.backupFrequency = req.body.backupFrequency;
    if (req.body.backupEmail) settings.system.backupEmail = req.body.backupEmail;
    if (req.body.sendBackupEmail !== undefined) settings.system.sendBackupEmail = req.body.sendBackupEmail;
    
    await settings.save();
    return successResponse(res, { settings }, 'Backup settings updated');
});

module.exports = {
    listBackups, createBackup, uploadBackup, restoreBackup,
    downloadBackup, sendBackupEmail, deleteBackup,
    getSettings, updateSettings,
};