const router = require('express').Router();
const User = require('../../models/farm/User');
const TeamMember = require('../../models/farm/TeamMember');
const Farm = require('../../models/farm/Farm');
const Settings = require('../../models/admin/Settings');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getFarmsForUser = async (user, role) => {
    let farms = [];
    let farmId = null;

    if (role === 'farmer') {
        const farmList = await Farm.find({ owner: user._id, status: 'active' });
        farms = farmList.map((f) => ({
            id: f._id,
            name: f.name,
            county: f.location?.county || '',
            subCounty: f.location?.subCounty || '',
        }));
        farmId = farms.length > 0 ? farms[0].id : null;
    } else {
        farmId = user?.farm || null;
        if (farmId) {
            const farm = await Farm.findById(farmId);
            farms = farm ? [{
                id: farm._id,
                name: farm.name,
                county: farm.location?.county || '',
                subCounty: farm.location?.subCounty || '',
            }] : [];
        }
    }

    return { farms, farmId };
};

const getFieldScanSettings = async () => {
    const settings = await Settings.findOne();
    const fieldScan = settings?.fieldScan || {};

    return {
        enabled: fieldScan.enabled ?? false,
        maxPhotosPerScan: fieldScan.maxPhotosPerScan ?? 100,
        captureInterval: fieldScan.captureInterval ?? 5,
        requireGpsAccuracy: fieldScan.requireGpsAccuracy ?? 15,
        allowedCropTypes: fieldScan.allowedCropTypes || ['tomato', 'maize', 'potato', 'bean', 'cassava', 'coffee', 'tea', 'wheat', 'rice'],
        minPhotoSize: fieldScan.minPhotoSize ?? 50,
        maxPhotoSize: fieldScan.maxPhotoSize ?? 500,
    };
};

const validateCredentials = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return errorResponse(res, 'Email and password required', 400);
    }

    let user = await User.findOne({ email }).select('+password');
    let role = 'farmer';

    if (!user) {
        user = await TeamMember.findOne({ email }).select('+password');
        role = user?.role || 'team';
    }

    if (!user) {
        return errorResponse(res, 'Invalid credentials', 401);
    }

    if (role === 'farmer') {
        if (user.approvalStatus !== 'approved') {
            return errorResponse(res, 'Account not approved', 403);
        }
        if (!user.isActive) {
            return errorResponse(res, 'Account deactivated', 403);
        }
    } else {
        if (user.status !== 'active') {
            return errorResponse(res, 'Account deactivated', 403);
        }
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        return errorResponse(res, 'Invalid credentials', 401);
    }

    const { farms, farmId } = await getFarmsForUser(user, role);
    const fieldScan = await getFieldScanSettings();

    return successResponse(res, {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            role,
            farmId,
            farms,
            county: user.county || '',
            subCounty: user.subCounty || '',
        },
        fieldScan,
    }, 'Credentials validated');
});

const getUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    let user = await User.findById(userId).select('-password');
    let role = 'farmer';

    if (!user) {
        user = await TeamMember.findById(userId).select('-password');
        role = user?.role || 'team';
    }

    if (!user) {
        return errorResponse(res, 'User not found', 404);
    }

    const { farms, farmId } = await getFarmsForUser(user, role);
    const fieldScan = await getFieldScanSettings();

    return successResponse(res, {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            role,
            farmId,
            farms,
            county: user.county || '',
            subCounty: user.subCounty || '',
        },
        fieldScan,
    });
});

router.post('/auth/validate', validateCredentials);
router.get('/user/:userId', getUserById);

module.exports = router;