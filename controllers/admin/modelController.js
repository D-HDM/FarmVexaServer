const Model = require('../../models/admin/Model');
const aiService = require('../../services/aiService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const createModel = asyncHandler(async (req, res) => {
    const model = await Model.create({
        ...req.body,
        createdBy: req.user.id,
    });
    return successResponse(res, { model }, 'Model created', 201);
});

const getAllModels = asyncHandler(async (req, res) => {
    const models = await Model.find().sort({ createdAt: -1 });
    return successResponse(res, { models });
});

const getModelById = asyncHandler(async (req, res) => {
    const model = await Model.findById(req.params.id);
    if (!model) return errorResponse(res, 'Model not found', 404);
    return successResponse(res, { model });
});

const updateModel = asyncHandler(async (req, res) => {
    const model = await Model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!model) return errorResponse(res, 'Model not found', 404);
    return successResponse(res, { model }, 'Model updated');
});

const deleteModel = asyncHandler(async (req, res) => {
    const model = await Model.findByIdAndDelete(req.params.id);
    if (!model) return errorResponse(res, 'Model not found', 404);
    return successResponse(res, null, 'Model deleted');
});

const trainModel = asyncHandler(async (req, res) => {
    const model = await Model.findById(req.params.id);
    if (!model) return errorResponse(res, 'Model not found', 404);

    model.status = 'training';
    await model.save();

    const result = await aiService.trainModel({
        modelName: model.name,
        version: model.version,
        datasetSize: model.datasetSize,
        classes: model.classes,
    });

    if (result.success) {
        model.status = 'trained';
        model.accuracy = result.data.accuracy;
        model.loss = result.data.loss;
        model.epochs = result.data.epochs;
        model.trainingTime = result.data.trainingTime;
        model.lastTrained = new Date();
        model.trainingHistory.push({
            date: new Date(),
            accuracy: result.data.accuracy,
            loss: result.data.loss,
            epochs: result.data.epochs,
            datasetSize: result.data.datasetSize,
            duration: result.data.trainingTime,
        });
        await model.save();
    } else {
        model.status = 'draft';
        await model.save();
    }

    return successResponse(res, { model }, 'Training completed');
});

const deployModel = asyncHandler(async (req, res) => {
    const model = await Model.findByIdAndUpdate(
        req.params.id,
        { status: 'active', deployedToPython: true },
        { new: true }
    );

    await Model.updateMany(
        { _id: { $ne: model._id }, status: 'active' },
        { status: 'retired' }
    );

    return successResponse(res, { model }, 'Model deployed');
});

module.exports = {
    createModel,
    getAllModels,
    getModelById,
    updateModel,
    deleteModel,
    trainModel,
    deployModel,
};