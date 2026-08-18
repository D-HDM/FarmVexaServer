const router = require('express').Router();
const { getFarmAlerts, markAsRead, deleteAlert, deleteAllAlerts } = require('../../controllers/farm/alertController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { ownsFarm } = require('../../middleware/farm/farm');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.get('/farm/:farmId', ownsFarm, getFarmAlerts);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteAlert);
router.delete('/farm/:farmId/all', ownsFarm, deleteAllAlerts);

module.exports = router;