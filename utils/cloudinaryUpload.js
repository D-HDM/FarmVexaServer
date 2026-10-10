const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

function uploadBufferToCloudinary(buffer, options = {}) {
    return new Promise((resolve, reject) => {
        if (!buffer || !Buffer.isBuffer(buffer)) {
            return reject(new Error('uploadBufferToCloudinary: buffer is required'));
        }

        const {
            folder = 'farmvexa',
            resourceType = 'image',
            publicId,
            filename,
            ...rest
        } = options;

        const uploadOptions = {
            folder,
            resource_type: resourceType,
            ...(publicId ? { public_id: publicId } : {}),
            ...(filename && !publicId ? { public_id: filename.replace(/\.[^.]+$/, '') } : {}),
            ...rest,
        };

        const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });

        streamifier.createReadStream(buffer).pipe(stream);
    });
}

function uploadStreamToCloudinary(readable, options = {}) {
    return new Promise((resolve, reject) => {
        const {
            folder = 'farmvexa',
            resourceType = 'image',
            publicId,
            ...rest
        } = options;

        const uploadOptions = {
            folder,
            resource_type: resourceType,
            ...(publicId ? { public_id: publicId } : {}),
            ...rest,
        };

        const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });

        readable.pipe(stream);
    });
}

async function destroyFromCloudinary(publicId, resourceType = 'image') {
    if (!publicId) return null;
    try {
        return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (err) {
        return { result: 'error', error: err.message };
    }
}

module.exports = {
    uploadBufferToCloudinary,
    uploadStreamToCloudinary,
    destroyFromCloudinary,
};