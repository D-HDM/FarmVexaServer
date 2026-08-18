const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            // Images
            'image/jpeg',
            'image/png',
            'image/webp',
            // Documents
            'application/pdf',
            'text/html',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.html', '.htm', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only image (JPG, PNG, WEBP) or document (PDF, HTML, DOC, DOCX) files are allowed'), false);
        }
    },
});

module.exports = upload;