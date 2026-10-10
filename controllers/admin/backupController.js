const backupService = require('../../services/backupService');
const Backup = require('../../models/admin/Backup');
const Settings = require('../../models/admin/Settings');
const { uploadBufferToCloudinary } = require('../../utils/cloudinaryUpload');
const { sendEmail } = require('../../config/hdmBridge');
const axios = require('axios');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const listBackups = asyncHandler(async (req, res) => {
    const backups = await backupService.listBackups();
    return successResponse(res, { backups });
});

const createBackup = asyncHandler(async (req, res) => {
    const backup = await backupService.createBackup(req.user.id);
    return successResponse(res, { backup }, 'Backup created successfully');
});

const uploadBackup = asyncHandler(async (req, res) => {
    if (!req.file || !req.file.buffer) return errorResponse(res, 'No file uploaded', 400);

    const originalName = req.file.originalname || `manual_backup_${Date.now()}.json`;

    try {
        const result = await uploadBufferToCloudinary(req.file.buffer, {
            folder: 'farmvexa/backups',
            resourceType: 'raw',
            publicId: originalName.replace(/\.[^.]+$/, ''),
        });

        const backup = await Backup.create({
            filename: originalName,
            cloudinaryUrl: result.secure_url,
            cloudinaryPublicId: result.public_id,
            size: req.file.size,
            status: 'uploaded',
            createdBy: req.user.id,
        });

        return successResponse(res, { backup }, 'Backup uploaded');
    } catch (err) {
        logger.error(`Backup upload failed: ${err.message}`);
        return errorResponse(res, 'Backup upload failed', 500);
    }
});

const restoreBackup = asyncHandler(async (req, res) => {
    const backup = await backupService.getBackup(req.params.id);
    if (!backup) return errorResponse(res, 'Backup not found', 404);

    const metadata = await backupService.restoreBackup(backup._id);
    return successResponse(res, { metadata }, 'Backup restored successfully');
});

const downloadBackup = asyncHandler(async (req, res) => {
    const backup = await backupService.getBackup(req.params.id);
    if (!backup) return errorResponse(res, 'Backup not found', 404);
    if (!backup.cloudinaryUrl) return errorResponse(res, 'Backup has no URL', 404);

    const response = await axios.get(backup.cloudinaryUrl, { responseType: 'arraybuffer', timeout: 60000 });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    return res.send(Buffer.from(response.data));
});

const sendBackupEmail = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) return errorResponse(res, 'Email required', 400);

    const backup = await backupService.getBackup(req.params.id);
    if (!backup) return errorResponse(res, 'Backup not found', 404);

    const html = `
        <p>Your FarmVexa backup is ready.</p>
        <p><strong>File:</strong> ${backup.filename}</p>
        <p><strong>Documents:</strong> ${backup.documents || 0}</p>
        <p><strong>Size:</strong> ${(backup.size / 1024).toFixed(1)} KB</p>
        <p><a href="${backup.cloudinaryUrl}">Download Backup</a></p>
    `;

    await sendEmail(email, 'FarmVexa Backup', html);
    return successResponse(res, { url: backup.cloudinaryUrl }, 'Backup email sent');
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