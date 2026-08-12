const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Check storage type
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';

// Cloudinary setup (only if using cloud)
if (STORAGE_TYPE === 'cloudinary') {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    console.log('✅ Cloudinary Configured');
}

// Local storage setup
const LOCAL_UPLOAD_PATH = process.env.LOCAL_UPLOAD_PATH || 'uploads';

if (!fs.existsSync(LOCAL_UPLOAD_PATH)) {
    fs.mkdirSync(LOCAL_UPLOAD_PATH, { recursive: true });
}

const uploadFile = async (filePath, options = {}) => {
    if (STORAGE_TYPE === 'cloudinary') {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: process.env.CLOUDINARY_FOLDER || 'farmvexa/crops',
            ...options,
        });
        return { url: result.secure_url, public_id: result.public_id, storage: 'cloudinary' };
    } else {
        const filename = path.basename(filePath);
        const destPath = path.join(LOCAL_UPLOAD_PATH, filename);
        fs.copyFileSync(filePath, destPath);
        return { url: `/uploads/${filename}`, path: destPath, storage: 'local' };
    }
};

const deleteFile = async (publicIdOrPath) => {
    if (STORAGE_TYPE === 'cloudinary') {
        await cloudinary.uploader.destroy(publicIdOrPath);
    } else {
        if (fs.existsSync(publicIdOrPath)) {
            fs.unlinkSync(publicIdOrPath);
        }
    }
};

module.exports = { uploadFile, deleteFile, STORAGE_TYPE, LOCAL_UPLOAD_PATH };