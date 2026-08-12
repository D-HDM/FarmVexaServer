const router = require('express').Router();
const { getTransactions, getTransaction, addTransaction, updateTransaction, deleteTransaction, getSummary } = require('../../controllers/farm/transactionController');
const farmerAuth = require('../../middleware/farm/auth');
const { ownsFarm } = require('../../middleware/farm/farm');
const { canAccessFinance } = require('../../middleware/farm/farmRole');

router.use(farmerAuth);

router.get('/farm/:farmId', ownsFarm, canAccessFinance, getTransactions);
router.get('/farm/:farmId/summary', ownsFarm, canAccessFinance, getSummary);
router.get('/:id', getTransaction);
router.post('/farm/:farmId', ownsFarm, canAccessFinance, addTransaction);
router.put('/:id', canAccessFinance, updateTransaction);
router.delete('/:id', canAccessFinance, deleteTransaction);

module.exports = router;