const crypto = require('crypto');

const generateRandomToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

const generateOTP = (length = 6) => {
    return Math.floor(Math.pow(10, length - 1) + Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1))).toString();
};

module.exports = { generateRandomToken, generateOTP };