const TeamMember = require('../../models/farm/TeamMember');
const { generateRandomToken } = require('../../utils/generateToken');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getTeam = asyncHandler(async (req, res) => {
    const members = await TeamMember.find({ farm: req.params.farmId }).sort({ createdAt: -1 });
    return successResponse(res, { members });
});

const getMember = asyncHandler(async (req, res) => {
    const member = await TeamMember.findById(req.params.id);
    if (!member) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { member });
});

const addMember = asyncHandler(async (req, res) => {
    const { name, role, phone, email, hireDate, salary, notes } = req.body;
    const password = generateRandomToken(8);

    const member = await TeamMember.create({
        farm: req.params.farmId, name, role, phone, email, password,
        hireDate, salary, notes,
    });

    if (email) {
        emailService.send(email, 'teamMemberAdded', {
            user: { name, email },
            role, farmName: req.farm?.name,
            email, password,
        }).catch(() => {});
    }
    if (phone) {
        smsService.send(phone, 'teamMemberAdded', {
            user: { name, phone },
            role, farmName: req.farm?.name,
            email, password,
        }).catch(() => {});
    }

    return successResponse(res, { member: { ...member.toObject(), password: undefined } }, 'Team member added', 201);
});

const updateMember = asyncHandler(async (req, res) => {
    const member = await TeamMember.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!member) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { member }, 'Updated');
});

const toggleStatus = asyncHandler(async (req, res) => {
    const member = await TeamMember.findById(req.params.id);
    if (!member) return errorResponse(res, 'Not found', 404);
    member.status = member.status === 'active' ? 'inactive' : 'active';
    await member.save();
    return successResponse(res, { member }, member.status === 'active' ? 'Activated' : 'Deactivated');
});

const deleteMember = asyncHandler(async (req, res) => {
    await TeamMember.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Deleted');
});

module.exports = { getTeam, getMember, addMember, updateMember, toggleStatus, deleteMember };