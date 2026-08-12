const PaymentMethod = require('../../models/admin/PaymentMethod');
const PaymentModel = require('../../models/admin/PaymentModel');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

// ============ PAYMENT METHODS ============

const getPaymentMethods = asyncHandler(async (req, res) => {
    const methods = await PaymentMethod.find().sort({ createdAt: -1 });
    return successResponse(res, { methods });
});

const getPaymentMethod = asyncHandler(async (req, res) => {
    const method = await PaymentMethod.findById(req.params.id);
    if (!method) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { method });
});

const createPaymentMethod = asyncHandler(async (req, res) => {
    const method = await PaymentMethod.create({ ...req.body, addedBy: req.user.id });
    return successResponse(res, { method }, 'Payment method created', 201);
});

const updatePaymentMethod = asyncHandler(async (req, res) => {
    const method = await PaymentMethod.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!method) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { method }, 'Updated');
});

const togglePaymentMethod = asyncHandler(async (req, res) => {
    const method = await PaymentMethod.findById(req.params.id);
    if (!method) return errorResponse(res, 'Not found', 404);
    method.enabled = !method.enabled;
    await method.save();
    return successResponse(res, { method }, method.enabled ? 'Enabled' : 'Disabled');
});

const deletePaymentMethod = asyncHandler(async (req, res) => {
    await PaymentMethod.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Deleted');
});

// ============ PAYMENT MODELS (PLANS) ============

const getPaymentModels = asyncHandler(async (req, res) => {
    const models = await PaymentModel.find().sort({ price: 1 });
    return successResponse(res, { models });
});

const getPaymentModel = asyncHandler(async (req, res) => {
    const model = await PaymentModel.findById(req.params.id);
    if (!model) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { model });
});

const createPaymentModel = asyncHandler(async (req, res) => {
    const model = await PaymentModel.create({ ...req.body, addedBy: req.user.id });
    return successResponse(res, { model }, 'Plan created', 201);
});

const updatePaymentModel = asyncHandler(async (req, res) => {
    const model = await PaymentModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!model) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { model }, 'Updated');
});

const togglePaymentModel = asyncHandler(async (req, res) => {
    const model = await PaymentModel.findById(req.params.id);
    if (!model) return errorResponse(res, 'Not found', 404);
    model.enabled = !model.enabled;
    await model.save();
    return successResponse(res, { model }, model.enabled ? 'Enabled' : 'Disabled');
});

const deletePaymentModel = asyncHandler(async (req, res) => {
    await PaymentModel.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Deleted');
});

module.exports = {
    getPaymentMethods, getPaymentMethod, createPaymentMethod, updatePaymentMethod, togglePaymentMethod, deletePaymentMethod,
    getPaymentModels, getPaymentModel, createPaymentModel, updatePaymentModel, togglePaymentModel, deletePaymentModel,
};