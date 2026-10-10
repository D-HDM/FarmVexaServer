const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 10,
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/heic',
            'image/heif',
            'application/pdf',
            'text/html',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        const allowedExts = [
            '.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif',
            '.pdf', '.html', '.htm', '.doc', '.docx',
        ];

        const ext = path.extname(file.originalname || '').toLowerCase();

        if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only image (JPG, PNG, WEBP) or document (PDF, HTML, DOC, DOCX) files are allowed'), false);
        }
    },
});

module.exports = upload;