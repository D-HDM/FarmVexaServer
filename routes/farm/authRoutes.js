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
const scopedAuth = require('../../middleware/farm/scopedAuth');
const { authLimiter } = require('../../middleware/global/rateLimiter');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/refresh-token', refreshTokenHandler);

router.get('/me', scopedAuth, getMe);

router.use(farmerAuth);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

module.exports = router;