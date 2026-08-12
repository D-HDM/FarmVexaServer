const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
    alert: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Alert',
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['sms', 'email'],
        required: true,
    },
    recipient: {
        type: String,
        required: true,
    },
    subject: String,
    message: String,
    status: {
        type: String,
        enum: ['sent', 'failed', 'delivered'],
        default: 'sent',
    },
    errorMessage: String,
    sentAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('NotificationLog', notificationLogSchema);