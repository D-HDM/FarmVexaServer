const router = require('express').Router();
const { uploadAndAnalyze, getFieldImages, getImageById, deleteImage } = require('../../controllers/farm/imageController');
const farmerAuth = require('../../middleware/farm/auth');
const upload = require('../../middleware/global/upload');

router.use(farmerAuth);

router.post('/upload', upload.single('cropImage'), uploadAndAnalyze);
router.get('/field/:fieldId', getFieldImages);
router.delete('/:id', deleteImage);
router.get('/:id', getImageById);

module.exports = router;