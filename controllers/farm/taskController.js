const Task = require('../../models/farm/Task');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getTasks = asyncHandler(async (req, res) => {
    const { status, assignedTo } = req.query;
    const query = { farm: req.params.farmId };
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;

    const tasks = await Task.find(query).populate('assignedTo', 'name role').sort({ dueDate: 1 });
    return successResponse(res, { tasks });
});

const getTask = asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id).populate('assignedTo', 'name role');
    if (!task) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { task });
});

const createTask = asyncHandler(async (req, res) => {
    const task = await Task.create({ ...req.body, farm: req.params.farmId });
    return successResponse(res, { task }, 'Task created', 201);
});

const updateTask = asyncHandler(async (req, res) => {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { task }, 'Updated');
});

const updateStatus = asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (!task) return errorResponse(res, 'Not found', 404);
    task.status = req.body.status;
    if (req.body.status === 'completed') task.completedAt = new Date();
    await task.save();
    return successResponse(res, { task }, 'Status updated');
});

const deleteTask = asyncHandler(async (req, res) => {
    await Task.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Deleted');
});

module.exports = { getTasks, getTask, createTask, updateTask, updateStatus, deleteTask };