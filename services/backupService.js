const mongoose = require('mongoose');
const axios = require('axios');
const Backup = require('../models/admin/Backup');
const { uploadBufferToCloudinary, destroyFromCloudinary } = require('../utils/cloudinaryUpload');
const logger = require('../utils/logger');

const EXCLUDED_COLLECTIONS = [
    'backups',
    'briefinglogs',
    'usages',
    'notificationlogs',
    'chats',
    'sensordata',
    'healthrecords',
];

class BackupService {
    async createBackup(adminId) {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        const backupData = {
            metadata: {
                app: 'FarmVexa',
                version: '1.0.0',
                createdAt: new Date().toISOString(),
                createdBy: adminId,
                collections: [],
            },
            data: {},
        };

        let totalDocuments = 0;

        for (const col of collections) {
            if (EXCLUDED_COLLECTIONS.includes(col.name)) continue;

            const docs = await db.collection(col.name).find().toArray();
            backupData.data[col.name] = docs;
            backupData.metadata.collections.push({ name: col.name, count: docs.length });
            totalDocuments += docs.length;
        }

        const jsonString = JSON.stringify(backupData, null, 2);
        const buffer = Buffer.from(jsonString, 'utf8');
        const publicId = `farmvexa_backup_${Date.now()}`;

        const uploadResult = await uploadBufferToCloudinary(buffer, {
            folder: 'farmvexa/backups',
            resourceType: 'raw',
            publicId,
            format: 'json',
        });

        const backup = await Backup.create({
            filename: `${publicId}.json`,
            cloudinaryUrl: uploadResult.secure_url,
            cloudinaryPublicId: uploadResult.public_id,
            size: buffer.length,
            collections: backupData.metadata.collections.length,
            documents: totalDocuments,
            status: 'created',
            createdBy: adminId,
        });

        logger.info(`Backup created: ${publicId} (${totalDocuments} docs, ${backupData.metadata.collections.length} collections)`);
        return backup;
    }

    async restoreBackup(backupId) {
        const backup = await Backup.findById(backupId);
        if (!backup) throw new Error('Backup not found');
        if (!backup.cloudinaryUrl) throw new Error('Backup has no Cloudinary URL');

        const response = await axios.get(backup.cloudinaryUrl, { responseType: 'text', timeout: 60000 });
        const backupData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        const db = mongoose.connection.db;

        for (const colName of Object.keys(backupData.data)) {
            const docs = backupData.data[colName];
            if (!docs || docs.length === 0) continue;

            await db.collection(colName).drop().catch(() => {});
            await db.createCollection(colName);
            await db.collection(colName).insertMany(docs);
        }

        logger.info(`Backup restored: ${backup.filename}`);
        return backupData.metadata;
    }

    async listBackups() {
        return Backup.find().sort({ createdAt: -1 }).populate('createdBy', 'name email');
    }

    async getBackup(id) {
        return Backup.findById(id).populate('createdBy', 'name email');
    }

    async deleteBackup(id) {
        const backup = await Backup.findById(id);
        if (!backup) throw new Error('Backup not found');

        if (backup.cloudinaryPublicId) {
            await destroyFromCloudinary(backup.cloudinaryPublicId, 'raw');
        }

        await Backup.findByIdAndDelete(id);
        logger.info(`Backup deleted: ${backup.filename}`);
        return backup;
    }
}

module.exports = new BackupService();