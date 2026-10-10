const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

async function uploadFile(buffer, options = {}) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
        throw new Error('uploadFile: expected a Buffer');
    }

    const {
        folder = process.env.CLOUDINARY_FOLDER || 'farmvexa/crops',
        resource_type = 'image',
        ...rest
    } = options;

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type, ...rest },
            (err, result) => {
                if (err) return reject(err);
                resolve({
                    url: result.secure_url,
                    public_id: result.public_id,
                    format: result.format,
                    bytes: result.bytes,
                    width: result.width,
                    height: result.height,
                    storage: 'cloudinary',
                });
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
}

async function deleteFile(publicId, resourceType = 'image') {
    if (!publicId) return null;
    try {
        return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (err) {
        return null;
    }
}

module.exports = cloudinary;
module.exports.uploadFile = uploadFile;
module.exports.deleteFile = deleteFile;
module.exports.cloudinary = cloudinary;