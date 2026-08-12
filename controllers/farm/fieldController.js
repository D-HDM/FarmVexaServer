const Field = require('../../models/farm/Field');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const createField = asyncHandler(async (req, res) => {
    const field = await Field.create({
        ...req.body,
        farm: req.params.farmId,
    });
    return successResponse(res, { field }, 'Field created', 201);
});

const getFarmFields = asyncHandler(async (req, res) => {
    const fields = await Field.find({ farm: req.params.farmId });
    return successResponse(res, { fields });
});

const getFieldById = asyncHandler(async (req, res) => {
    const field = await Field.findById(req.params.id).populate('farm');
    if (!field) return errorResponse(res, 'Field not found', 404);
    return successResponse(res, { field });
});

const updateField = asyncHandler(async (req, res) => {
    const field = await Field.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!field) return errorResponse(res, 'Field not found', 404);
    return successResponse(res, { field }, 'Field updated');
});

const deleteField = asyncHandler(async (req, res) => {
    const field = await Field.findByIdAndDelete(req.params.id);
    if (!field) return errorResponse(res, 'Field not found', 404);
    return successResponse(res, null, 'Field deleted');
});

module.exports = {
    createField,
    getFarmFields,
    getFieldById,
    updateField,
    deleteField,
};