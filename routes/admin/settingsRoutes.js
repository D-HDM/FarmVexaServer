const router = require('express').Router();
const {
    getSettings,
    updateSettings,
    getAiConfig,
    updateAiProvider,
    testAiProvider,
} = require('../../controllers/admin/settingsController');
const adminAuth = require('../../middleware/admin/adminAuth');
const { requireRole } = require('../../middleware/admin/role');

// Multipart parser for image-based test uploads.
// We reuse the existing upload middleware if it targets memory storage.
let upload;
try {
    upload = require('../../middleware/global/upload');
} catch {
    upload = null;
}

router.use(adminAuth);

// --- Existing settings CRUD ---
router.get('/', getSettings);
router.put('/', requireRole('super_admin'), updateSettings);

// --- AI provider config ---
// GET is used by FastAPI's ai_config_service (with X-API-Key), so
// this route must accept EITHER an admin JWT OR the internal API key.
// adminAuth above already handles the JWT path; FastAPI calls bypass
// adminAuth by going through /api/internal/ai-config (see below).
router.get('/ai/config', getAiConfig);
router.put('/ai/config/:feature', requireRole('super_admin'), updateAiProvider);

// Image upload for vision tests is optional (chat tests skip it).
const testUploadMiddleware = upload
    ? upload.single('image')
    : (req, res, next) => next();

router.post(
    '/ai/test/:feature/:provider',
    requireRole('super_admin'),
    testUploadMiddleware,
    testAiProvider
);

module.exports = router;