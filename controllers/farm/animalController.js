const Animal = require('../../models/farm/Animal');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getAnimals = asyncHandler(async (req, res) => {
    const { type, status, isBatch } = req.query;
    const query = { farm: req.params.farmId };
    if (type) query.type = type;
    if (status) query.status = status;
    if (isBatch !== undefined) query.isBatch = isBatch === 'true';

    const animals = await Animal.find(query).populate('motherId', 'tagId name').sort({ createdAt: -1 });
    const counts = {
        total: animals.length,
        active: animals.filter((a) => a.status === 'active').length,
        byType: {},
    };
    animals.forEach((a) => {
        counts.byType[a.type] = (counts.byType[a.type] || 0) + 1;
    });

    return successResponse(res, { animals, counts });
});

const getAnimal = asyncHandler(async (req, res) => {
    const animal = await Animal.findById(req.params.id).populate('motherId', 'tagId name');
    if (!animal) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { animal });
});

const addAnimal = asyncHandler(async (req, res) => {
    const animal = await Animal.create({ ...req.body, farm: req.params.farmId });
    return successResponse(res, { animal }, 'Animal added', 201);
});

const updateAnimal = asyncHandler(async (req, res) => {
    const animal = await Animal.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!animal) return errorResponse(res, 'Not found', 404);

    if (animal.isBatch && req.body.batchMortality !== undefined) {
        animal.batchCurrent = animal.batchQuantity - (animal.batchMortality || 0);
        await animal.save();
    }

    return successResponse(res, { animal }, 'Updated');
});

const updateStatus = asyncHandler(async (req, res) => {
    const animal = await Animal.findById(req.params.id);
    if (!animal) return errorResponse(res, 'Not found', 404);
    animal.status = req.body.status;
    await animal.save();
    return successResponse(res, { animal }, 'Status updated');
});

const recordMortality = asyncHandler(async (req, res) => {
    const animal = await Animal.findById(req.params.id);
    if (!animal) return errorResponse(res, 'Not found', 404);
    if (!animal.isBatch) return errorResponse(res, 'Only batches can record mortality', 400);

    animal.batchMortality = (animal.batchMortality || 0) + Number(req.body.count || 1);
    animal.batchCurrent = animal.batchQuantity - animal.batchMortality;
    await animal.save();
    return successResponse(res, { animal }, `Recorded ${req.body.count || 1} deaths. Current: ${animal.batchCurrent}`);
});

const deleteAnimal = asyncHandler(async (req, res) => {
    await Animal.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Deleted');
});

module.exports = { getAnimals, getAnimal, addAnimal, updateAnimal, updateStatus, recordMortality, deleteAnimal };