const mongoose = require('mongoose');

const marketInquirySchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketProduct', required: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyerName: { type: String, required: true, trim: true },
    buyerEmail: { type: String, trim: true },
    buyerPhone: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    sentEmail: { type: Boolean, default: false },
    sentSMS: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    readAt: Date,
}, { timestamps: true });

marketInquirySchema.index({ farmer: 1, isRead: 1 });
marketInquirySchema.index({ product: 1 });
marketInquirySchema.index({ createdAt: -1 });

module.exports = mongoose.model('MarketInquiry', marketInquirySchema);