const validateImageFile = (file, maxSizeMB = 10) => {
    if (!file) {
        return { valid: false, message: 'No file provided' };
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
        return { valid: false, message: 'File must be an image (JPEG, PNG, WEBP)' };
    }

    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
        return { valid: false, message: `File too large. Max ${maxSizeMB}MB` };
    }

    return { valid: true };
};

module.exports = { validateImageFile };