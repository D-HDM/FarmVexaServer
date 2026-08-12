const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

const chatSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
        type: String,
        default: 'New Chat',
        trim: true,
    },
    messages: [messageSchema],
    isActive: {
        type: Boolean,
        default: true,
    },
    lastMessageAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

chatSchema.index({ user: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);