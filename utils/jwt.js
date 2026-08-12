const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

const generateToken = (userId, role) => {
    return jwt.sign({ id: userId, role }, env.jwtSecret, {
        expiresIn: env.jwtExpire,
    });
};

const generateRefreshToken = (userId, role) => {
    return jwt.sign({ id: userId, role }, env.jwtRefreshSecret, {
        expiresIn: env.jwtRefreshExpire,
    });
};

const verifyToken = (token) => {
    return jwt.verify(token, env.jwtSecret);
};

const verifyRefreshToken = (token) => {
    return jwt.verify(token, env.jwtRefreshSecret);
};

const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
    return bcrypt.compare(password, hashedPassword);
};

module.exports = {
    generateToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken,
    hashPassword,
    comparePassword,
};