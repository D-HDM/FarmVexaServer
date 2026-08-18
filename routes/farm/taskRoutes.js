const router = require('express').Router();
const { getTasks, getTask, createTask, updateTask, updateStatus, deleteTask } = require('../../controllers/farm/taskController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { ownsFarm } = require('../../middleware/farm/farm');
const { canManageTasks } = require('../../middleware/farm/farmRole');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.get('/farm/:farmId', ownsFarm, getTasks);
router.get('/:id', getTask);
router.post('/farm/:farmId', ownsFarm, canManageTasks, createTask);
router.put('/:id', canManageTasks, updateTask);
router.put('/:id/status', canManageTasks, updateStatus);
router.delete('/:id', canManageTasks, deleteTask);

module.exports = router;