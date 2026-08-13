const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Backup = require('../models/admin/Backup');
const logger = require('../utils/logger');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

class BackupService {
    async createBackup(adminId) {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        const excludedCollections = [
            'backups',
            'briefinglogs',
            'usages',
            'notificationlogs',
            'chats',
            'sensordata',
            'healthrecords',
        ];

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
            if (excludedCollections.includes(col.name)) continue;

            const docs = await db.collection(col.name).find().toArray();
            backupData.data[col.name] = docs;
            backupData.metadata.collections.push({ name: col.name, count: docs.length });
            totalDocuments += docs.length;
        }

        const filename = `farmvexa_backup_${Date.now()}.json`;
        const filePath = path.join(BACKUP_DIR, filename);
        fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

        const stats = fs.statSync(filePath);
        const backup = await Backup.create({
            filename,
            size: stats.size,
            collections: backupData.metadata.collections.length,
            documents: totalDocuments,
            status: 'created',
            createdBy: adminId,
        });

        logger.info(`Backup created: ${filename} (${totalDocuments} documents, ${backupData.metadata.collections.length} collections)`);
        return backup;
    }

    async restoreBackup(filename) {
        const filePath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filePath)) throw new Error('Backup file not found');

        const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const db = mongoose.connection.db;

        for (const colName of Object.keys(backupData.data)) {
            const docs = backupData.data[colName];
            if (docs.length === 0) continue;

            // Drop existing collection and recreate
            await db.collection(colName).drop().catch(() => {});
            await db.createCollection(colName);
            await db.collection(colName).insertMany(docs);
        }

        logger.info(`Backup restored: ${filename}`);
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

        const filePath = path.join(BACKUP_DIR, backup.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await Backup.findByIdAndDelete(id);
        logger.info(`Backup deleted: ${backup.filename}`);
        return backup;
    }
}

module.exports = new BackupService();