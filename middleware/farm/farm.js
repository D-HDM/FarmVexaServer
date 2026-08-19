const { errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const Farm = require('../../models/farm/Farm');
const TeamMember = require('../../models/farm/TeamMember');

const ownsFarm = asyncHandler(async (req, res, next) => {
    const farmId = req.params.farmId || req.params.id || req.body.farmId;

    if (req.user.role === 'farmer') {
        const farm = await Farm.findById(farmId);
        if (!farm) return errorResponse(res, 'Farm not found', 404);
        if (farm.owner.toString() !== req.user.id.toString()) return errorResponse(res, 'Not authorized', 403);
        req.farm = farm;
    } else {
        const member = await TeamMember.findById(req.user.id);
        if (!member || member.farm.toString() !== farmId.toString()) return errorResponse(res, 'Not authorized', 403);
        req.farm = await Farm.findById(farmId);
    }

    next();
});

const ownsField = asyncHandler(async (req, res, next) => {
    const Field = require('../../models/farm/Field');
    const fieldId = req.params.fieldId || req.params.id || req.body.fieldId;
    const field = await Field.findById(fieldId);
    if (!field) return errorResponse(res, 'Field not found', 404);

    if (req.user.role === 'farmer') {
        const farm = await Farm.findOne({ _id: field.farm, owner: req.user.id });
        if (!farm) return errorResponse(res, 'Not authorized', 403);
    } else {
        const member = await TeamMember.findById(req.user.id);
        if (!member || member.farm.toString() !== field.farm.toString()) return errorResponse(res, 'Not authorized', 403);
    }

    req.field = field;
    next();
});

module.exports = { ownsFarm, ownsField };