const HealthRecord = require('../../models/farm/HealthRecord');
const Animal = require('../../models/farm/Animal');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getRecords = asyncHandler(async (req, res) => {
    const { animal, recordType } = req.query;
    const query = { farm: req.params.farmId };
    if (animal) query.animal = animal;
    if (recordType) query.recordType = recordType;

    const records = await HealthRecord.find(query).populate('animal', 'tagId name type').sort({ date: -1 });
    return successResponse(res, { records });
});

const getRecord = asyncHandler(async (req, res) => {
    const record = await HealthRecord.findById(req.params.id).populate('animal', 'tagId name type');
    if (!record) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { record });
});

const addRecord = asyncHandler(async (req, res) => {
    const record = await HealthRecord.create({ ...req.body, farm: req.params.farmId });
    return successResponse(res, { record }, 'Health record added', 201);
});

const updateRecord = asyncHandler(async (req, res) => {
    const record = await HealthRecord.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!record) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { record }, 'Updated');
});

const deleteRecord = asyncHandler(async (req, res) => {
    await HealthRecord.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Deleted');
});

const getUpcomingVaccinations = asyncHandler(async (req, res) => {
    const upcoming = await HealthRecord.find({
        farm: req.params.farmId,
        recordType: 'vaccination',
        nextCheckup: { $gte: new Date() },
    }).populate('animal', 'tagId name type').sort({ nextCheckup: 1 });

    return successResponse(res, { upcoming });
});

const getOverdueVaccinations = asyncHandler(async (req, res) => {
    const overdue = await HealthRecord.find({
        farm: req.params.farmId,
        recordType: 'vaccination',
        nextCheckup: { $lt: new Date() },
    }).populate('animal', 'tagId name type').sort({ nextCheckup: 1 });

    return successResponse(res, { overdue });
});

module.exports = { getRecords, getRecord, addRecord, updateRecord, deleteRecord, getUpcomingVaccinations, getOverdueVaccinations };