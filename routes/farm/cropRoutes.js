const router = require('express').Router();
const { createCrop, getFieldCrops, getCropById, updateCrop, deleteCrop } = require('../../controllers/farm/cropController');
const farmerAuth = require('../../middleware/farm/auth');
const { ownsField } = require('../../middleware/farm/farm');
const { isFarmerOrManager } = require('../../middleware/farm/farmRole');

router.use(farmerAuth);

router.get('/field/:fieldId', ownsField, getFieldCrops);
router.get('/:id', getCropById);
router.post('/field/:fieldId', ownsField, isFarmerOrManager, createCrop);
router.put('/:id', isFarmerOrManager, updateCrop);
router.delete('/:id', isFarmerOrManager, deleteCrop);

module.exports = router;