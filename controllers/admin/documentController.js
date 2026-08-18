const Document = require('../../models/admin/Document');
const { uploadFile, deleteFile } = require('../../config/cloudinary');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const fs = require('fs');
const logger = require('../../utils/logger');

const uploadDocument = asyncHandler(async (req, res) => {
    if (!req.file) return errorResponse(res, 'No file provided', 400);

    const { name, type, version, platform, visibility } = req.body;

    if (!name) return errorResponse(res, 'Document name is required', 400);
    if (!type) return errorResponse(res, 'Document type is required', 400);

    const allowedTypes = ['user_guide', 'copyright', 'pricing', 'terms', 'privacy', 'cookies', 'other'];
    if (!allowedTypes.includes(type)) {
        return errorResponse(res, `Invalid type. Allowed: ${allowedTypes.join(', ')}`, 400);
    }

    // Default visibility by type
    const defaultVisibility = {
        user_guide: 'farmer',
        copyright: 'admin',
        pricing: 'public',
        terms: 'public',
        privacy: 'public',
        cookies: 'public',
        other: 'public',
    };

    try {
        const fileExt = req.file.originalname.split('.').pop() || 'pdf';
        const uploadResult = await uploadFile(req.file.path, {
            folder: 'farmvexa/documents',
            resource_type: 'raw',
        });

        fs.unlink(req.file.path, () => {});

        const document = await Document.create({
            name,
            type,
            visibility: visibility || defaultVisibility[type] || 'public',
            cloudinaryUrl: uploadResult.url,
            cloudinaryPublicId: uploadResult.public_id,
            fileType: fileExt,
            fileSize: req.file.size,
            version: version || '1.0.0',
            platform: platform || 'all',
            enabled: true,
            addedBy: req.user.id,
        });

        return successResponse(res, { document }, 'Document uploaded', 201);
    } catch (error) {
        fs.unlink(req.file.path, () => {});
        logger.error(`Document upload failed: ${error.message}`);
        return errorResponse(res, `Upload failed: ${error.message}`, 500);
    }
});

const getDocuments = asyncHandler(async (req, res) => {
    const { type, enabled, visibility } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (enabled !== undefined) filter.enabled = enabled === 'true';
    if (visibility) filter.visibility = visibility;

    const documents = await Document.find(filter).sort({ createdAt: -1 });
    return successResponse(res, { documents });
});

const getDocumentById = asyncHandler(async (req, res) => {
    const document = await Document.findById(req.params.id);
    if (!document) return errorResponse(res, 'Document not found', 404);
    return successResponse(res, { document });
});

const updateDocument = asyncHandler(async (req, res) => {
    const { name, type, version, platform, enabled, visibility } = req.body;
    const updateFields = {};
    if (name) updateFields.name = name;
    if (type) updateFields.type = type;
    if (version) updateFields.version = version;
    if (platform) updateFields.platform = platform;
    if (enabled !== undefined) updateFields.enabled = enabled;
    if (visibility) updateFields.visibility = visibility;

    const document = await Document.findByIdAndUpdate(req.params.id, updateFields, {
        new: true,
        runValidators: true,
    });
    if (!document) return errorResponse(res, 'Document not found', 404);
    return successResponse(res, { document }, 'Document updated');
});

const deleteDocument = asyncHandler(async (req, res) => {
    const document = await Document.findById(req.params.id);
    if (!document) return errorResponse(res, 'Document not found', 404);

    try {
        await deleteFile(document.cloudinaryPublicId, 'raw');
    } catch (error) {
        logger.warn(`Cloudinary delete failed: ${error.message}`);
    }

    await Document.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Document deleted');
});

module.exports = {
    uploadDocument,
    getDocuments,
    getDocumentById,
    updateDocument,
    deleteDocument,
};