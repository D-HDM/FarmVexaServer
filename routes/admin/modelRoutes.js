const router = require('express').Router();
const { createModel, getAllModels, getModelById, updateModel, deleteModel, trainModel, deployModel } = require('../../controllers/admin/modelController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.post('/', createModel);
router.get('/', getAllModels);
router.get('/:id', getModelById);
router.put('/:id', updateModel);
router.delete('/:id', deleteModel);
router.post('/:id/train', trainModel);
router.post('/:id/deploy', deployModel);

module.exports = router;