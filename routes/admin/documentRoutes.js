const router = require('express').Router();
const {
    uploadDocument,
    getDocuments,
    getDocumentById,
    updateDocument,
    deleteDocument,
} = require('../../controllers/admin/documentController');
const adminAuth = require('../../middleware/admin/adminAuth');
const upload = require('../../middleware/global/upload');

router.use(adminAuth);

router.post('/upload', upload.single('document'), uploadDocument);
router.get('/', getDocuments);
router.get('/:id', getDocumentById);
router.put('/:id', updateDocument);
router.delete('/:id', deleteDocument);

module.exports = router;