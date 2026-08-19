const User = require('../../models/farm/User');
const Farm = require('../../models/farm/Farm');
const Field = require('../../models/farm/Field');
const Crop = require('../../models/farm/Crop');
const CropImage = require('../../models/farm/CropImage');
const Animal = require('../../models/farm/Animal');
const HealthRecord = require('../../models/farm/HealthRecord');
const ProductionRecord = require('../../models/farm/ProductionRecord');
const Stock = require('../../models/farm/Stock');
const Inventory = require('../../models/farm/Inventory');
const Equipment = require('../../models/farm/Equipment');
const Transaction = require('../../models/farm/Transaction');
const ProductPrice = require('../../models/farm/ProductPrice');
const Task = require('../../models/farm/Task');
const TeamMember = require('../../models/farm/TeamMember');
const Alert = require('../../models/farm/Alert');
const Chat = require('../../models/farm/Chat');
const Device = require('../../models/farm/Device');
const SensorReading = require('../../models/farm/SensorReading');
const FieldScan = require('../../models/farm/FieldScan');
const Weather = require('../../models/farm/Weather');
const MarketProduct = require('../../models/farm/MarketProduct');
const MarketInquiry = require('../../models/farm/MarketInquiry');
const NotificationLog = require('../../models/farm/NotificationLog');
const PaymentRecord = require('../../models/admin/PaymentRecord');
const PendingApproval = require('../../models/admin/PendingApproval');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const query = { role: 'farmer' };

    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (status === 'pending') query.approvalStatus = 'pending';
    if (status === 'approved') query.approvalStatus = 'approved';
    if (status === 'rejected') query.approvalStatus = 'rejected';

    const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

    const usersWithDetails = await Promise.all(
        users.map(async (user) => {
            const farmCount = await Farm.countDocuments({ owner: user._id });
            const payment = await PaymentRecord.findOne({ user: user._id }).sort({ createdAt: -1 }).lean();
            return { ...user, farmCount, payment: payment ? { plan: payment.plan, amount: payment.amount, status: payment.status, methodType: payment.methodType, reference: payment.reference } : null };
        })
    );

    const total = await User.countDocuments(query);

    return successResponse(res, {
        users: usersWithDetails,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) {
        return errorResponse(res, 'User not found', 404);
    }

    const farms = await Farm.find({ owner: user._id });
    const payment = await PaymentRecord.findOne({ user: user._id }).sort({ createdAt: -1 }).lean();

    return successResponse(res, { user, farms, payment });
});

const toggleUserStatus = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        return errorResponse(res, 'User not found', 404);
    }

    user.isActive = !user.isActive;
    await user.save();

    return successResponse(res, { user }, `User ${user.isActive ? 'activated' : 'deactivated'}`);
});

const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    const farms = await Farm.find({ owner: user._id }).select('_id').lean();
    const farmIds = farms.map(f => f._id);

    const fields = await Field.find({ farm: { $in: farmIds } }).select('_id').lean();
    const fieldIds = fields.map(f => f._id);

    const devices = await Device.find({ farm: { $in: farmIds } }).select('_id').lean();
    const deviceIds = devices.map(d => d._id);

    if (farmIds.length > 0) {
        await Crop.deleteMany({ field: { $in: fieldIds } });
        await CropImage.deleteMany({ field: { $in: fieldIds } });
        await Animal.deleteMany({ farm: { $in: farmIds } });
        await HealthRecord.deleteMany({ farm: { $in: farmIds } });
        await ProductionRecord.deleteMany({ farm: { $in: farmIds } });
        await Stock.deleteMany({ farm: { $in: farmIds } });
        await Inventory.deleteMany({ farm: { $in: farmIds } });
        await Equipment.deleteMany({ farm: { $in: farmIds } });
        await Transaction.deleteMany({ farm: { $in: farmIds } });
        await ProductPrice.deleteMany({ farm: { $in: farmIds } });
        await Task.deleteMany({ farm: { $in: farmIds } });
        await TeamMember.deleteMany({ farm: { $in: farmIds } });
        await Alert.deleteMany({ farm: { $in: farmIds } });
        await Device.deleteMany({ farm: { $in: farmIds } });
        await Weather.deleteMany({ farm: { $in: farmIds } });
        await MarketProduct.deleteMany({ farm: { $in: farmIds } });
        await MarketInquiry.deleteMany({ product: { $in: await MarketProduct.find({ farm: { $in: farmIds } }).distinct('_id') } });
        await Farm.deleteMany({ owner: user._id });
    }

    if (deviceIds.length > 0) {
        await SensorReading.deleteMany({ device: { $in: deviceIds } });
    }

    await FieldScan.deleteMany({ user: user._id });
    await Chat.deleteMany({ user: user._id });
    await TeamMember.deleteMany({ user: user._id });
    await NotificationLog.deleteMany({ user: user._id });
    await PaymentRecord.deleteMany({ user: user._id });
    await PendingApproval.deleteMany({ user: user._id });

    await User.findByIdAndDelete(user._id);

    return successResponse(res, null, 'User and all associated data deleted');
});

module.exports = {
    getAllUsers,
    getUserById,
    toggleUserStatus,
    deleteUser,
};