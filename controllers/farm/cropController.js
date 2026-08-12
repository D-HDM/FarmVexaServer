const Crop = require('../../models/farm/Crop');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const createCrop = asyncHandler(async (req, res) => {
    const crop = await Crop.create({
        ...req.body,
        field: req.params.fieldId,
    });
    return successResponse(res, { crop }, 'Crop record created', 201);
});

const getFieldCrops = asyncHandler(async (req, res) => {
    const crops = await Crop.find({ field: req.params.fieldId }).sort({ plantingDate: -1 });
    return successResponse(res, { crops });
});

const getCropById = asyncHandler(async (req, res) => {
    const crop = await Crop.findById(req.params.id).populate('field');
    if (!crop) return errorResponse(res, 'Crop not found', 404);
    return successResponse(res, { crop });
});

const updateCrop = asyncHandler(async (req, res) => {
    const crop = await Crop.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!crop) return errorResponse(res, 'Crop not found', 404);
    return successResponse(res, { crop }, 'Crop updated');
});

const deleteCrop = asyncHandler(async (req, res) => {
    const crop = await Crop.findByIdAndDelete(req.params.id);
    if (!crop) return errorResponse(res, 'Crop not found', 404);
    return successResponse(res, null, 'Crop deleted');
});

module.exports = {
    createCrop,
    getFieldCrops,
    getCropById,
    updateCrop,
    deleteCrop,
};