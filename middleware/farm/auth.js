const { verifyToken } = require('../../utils/jwt');
const { errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const farmerAuth = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return errorResponse(res, 'Not authorized', 401);

    const decoded = verifyToken(token);
    if (decoded.role !== 'farmer' && decoded.role !== 'worker' && decoded.role !== 'vet' && decoded.role !== 'manager') {
        return errorResponse(res, 'Access denied', 403);
    }

    req.user = decoded;
    next();
});

module.exports = farmerAuth;