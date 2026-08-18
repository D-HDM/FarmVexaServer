const router = require('express').Router();
const { getTeam, getMember, addMember, updateMember, toggleStatus, deleteMember } = require('../../controllers/farm/teamController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { ownsFarm } = require('../../middleware/farm/farm');
const { canManageTeam } = require('../../middleware/farm/farmRole');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.get('/farm/:farmId', ownsFarm, canManageTeam, getTeam);
router.get('/:id', getMember);
router.post('/farm/:farmId', ownsFarm, canManageTeam, addMember);
router.put('/:id', canManageTeam, updateMember);
router.put('/:id/toggle', canManageTeam, toggleStatus);
router.delete('/:id', canManageTeam, deleteMember);

module.exports = router;