const Equipment = require('../../models/farm/Equipment');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getEquipment = asyncHandler(async (req, res) => {
    const { category } = req.query;
    const query = { farm: req.params.farmId };
    if (category) query.category = category;

    const items = await Equipment.find(query).sort({ createdAt: -1 });
    const maintenanceDue = items.filter((e) => e.nextMaintenance && new Date(e.nextMaintenance) <= new Date(Date.now() + 7 * 86400000));

    return successResponse(res, { items, maintenanceDue });
});

const getOne = asyncHandler(async (req, res) => {
    const item = await Equipment.findById(req.params.id);
    if (!item) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { item });
});

const addEquipment = asyncHandler(async (req, res) => {
    const item = await Equipment.create({ ...req.body, farm: req.params.farmId });
    return successResponse(res, { item }, 'Equipment added', 201);
});

const updateEquipment = asyncHandler(async (req, res) => {
    const item = await Equipment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { item }, 'Updated');
});

const recordMaintenance = asyncHandler(async (req, res) => {
    const { cost, notes } = req.body;
    const item = await Equipment.findById(req.params.id);
    if (!item) return errorResponse(res, 'Not found', 404);

    item.lastMaintenance = new Date();
    if (item.maintenanceFrequency) {
        const next = new Date();
        const freq = { weekly: 7, monthly: 30, quarterly: 90, biannually: 180, annually: 365 };
        next.setDate(next.getDate() + (freq[item.maintenanceFrequency] || 30));
        item.nextMaintenance = next;
    }
    item.condition = req.body.condition || item.condition;
    await item.save();

    return successResponse(res, { item }, 'Maintenance recorded');
});

const deleteEquipment = asyncHandler(async (req, res) => {
    await Equipment.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Deleted');
});

module.exports = { getEquipment, getOne, addEquipment, updateEquipment, recordMaintenance, deleteEquipment };