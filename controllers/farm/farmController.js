const Farm = require('../../models/farm/Farm');
const Field = require('../../models/farm/Field');
const FarmManagement = require('../../models/admin/FarmManagement');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const createFarm = asyncHandler(async (req, res) => {
    const farm = await Farm.create({
        ...req.body,
        owner: req.user.id,
    });

    await FarmManagement.create({ farm: farm._id });

    return successResponse(res, { farm }, 'Farm created', 201);
});

const getMyFarms = asyncHandler(async (req, res) => {
    const farms = await Farm.find({ owner: req.user.id });
    return successResponse(res, { farms });
});

const getFarmById = asyncHandler(async (req, res) => {
    const farm = await Farm.findById(req.params.id);
    if (!farm) return errorResponse(res, 'Farm not found', 404);

    const fields = await Field.find({ farm: farm._id });
    const management = await FarmManagement.findOne({ farm: farm._id });

    return successResponse(res, { farm, fields, management });
});

const updateFarm = asyncHandler(async (req, res) => {
    const farm = await Farm.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!farm) return errorResponse(res, 'Farm not found', 404);
    return successResponse(res, { farm }, 'Farm updated');
});

const deleteFarm = asyncHandler(async (req, res) => {
    const farm = await Farm.findByIdAndDelete(req.params.id);
    if (!farm) return errorResponse(res, 'Farm not found', 404);

    await Field.deleteMany({ farm: farm._id });
    await FarmManagement.findOneAndDelete({ farm: farm._id });

    return successResponse(res, null, 'Farm deleted');
});

module.exports = {
    createFarm,
    getMyFarms,
    getFarmById,
    updateFarm,
    deleteFarm,
};