const router = require('express').Router();
const { createField, getFarmFields, getFieldById, updateField, deleteField } = require('../../controllers/farm/fieldController');
const farmerAuth = require('../../middleware/farm/auth');
const { ownsFarm, ownsField } = require('../../middleware/farm/farm');

router.use(farmerAuth);

router.post('/farm/:farmId', ownsFarm, createField);
router.get('/farm/:farmId', ownsFarm, getFarmFields);
router.get('/:id', getFieldById);
router.put('/:id', ownsField, updateField);
router.delete('/:id', ownsField, deleteField);

module.exports = router;