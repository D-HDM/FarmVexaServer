const router = require('express').Router();
const { uploadAndAnalyze, getFieldImages, getImageById, deleteImage } = require('../../controllers/farm/imageController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const upload = require('../../middleware/global/upload');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.post('/upload', upload.single('cropImage'), uploadAndAnalyze);
router.get('/field/:fieldId', getFieldImages);
router.delete('/:id', deleteImage);
router.get('/:id', getImageById);

module.exports = router;