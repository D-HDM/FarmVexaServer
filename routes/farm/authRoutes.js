const router = require('express').Router();
const {
    register,
    login,
    getMe,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    refreshTokenHandler,
} = require('../../controllers/farm/authController');
const farmerAuth = require('../../middleware/farm/auth');
const { authLimiter } = require('../../middleware/global/rateLimiter');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/refresh-token', refreshTokenHandler);

// Renewal-safe auth: token required but no subscription/isActive check
const renewalAuth = require('../../middleware/farm/renewalAuth');
router.get('/me', renewalAuth, getMe);

router.use(farmerAuth);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

module.exports = router;