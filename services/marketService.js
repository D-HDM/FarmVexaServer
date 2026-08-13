const MarketProduct = require('../models/farm/MarketProduct');
const MarketInquiry = require('../models/farm/MarketInquiry');
const emailService = require('./emailService');
const smsService = require('./smsService');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

class MarketService {
    async isMarketEnabled() {
        const settings = await Settings.findOne();
        return settings?.system?.market?.enabled || false;
    }

    async listActiveProducts(query = {}) {
        const { category, search, county } = query;
        const filter = { status: 'active' };

        if (category) filter.category = category;
        if (county) filter['location.county'] = county;
        if (search) filter.name = { $regex: search, $options: 'i' };

        return MarketProduct.find(filter)
            .populate('farmer', 'name phone')
            .populate('farm', 'name')
            .sort({ createdAt: -1 });
    }

    async getProduct(productId) {
        return MarketProduct.findById(productId)
            .populate('farmer', 'name phone email')
            .populate('farm', 'name');
    }

    async createInquiry(productId, data) {
        const product = await this.getProduct(productId);
        if (!product) throw new Error('Product not found');

        const inquiry = await MarketInquiry.create({
            product: productId,
            farmer: product.farmer?._id,
            buyerName: data.buyerName,
            buyerEmail: data.buyerEmail,
            buyerPhone: data.buyerPhone,
            message: data.message,
        });

        // Send SMS to farmer
        if (product.contactWhatsapp || product.contactPhone) {
            const phone = product.contactWhatsapp || product.contactPhone;
            const smsMsg = `FarmVexa Market: New inquiry for ${product.name} from ${data.buyerName}${data.buyerPhone ? ' (' + data.buyerPhone + ')' : ''}. Message: ${data.message?.substring(0, 80)}`;
            try {
                await smsService.send(phone, 'farmerAlertMedium', {
                    user: { name: product.farmer?.name || 'Farmer' },
                    message: smsMsg,
                    farmName: product.farm?.name || 'Your Farm',
                });
                inquiry.sentSMS = true;
            } catch (err) {
                logger.error(`Market inquiry SMS failed: ${err.message}`);
            }
        }

        // Send email to farmer
        if (product.contactEmail || product.farmer?.email) {
            const email = product.contactEmail || product.farmer?.email;
            try {
                await emailService.send(email, 'farmerAlertMedium', {
                    user: { name: product.farmer?.name || 'Farmer' },
                    message: `New inquiry for ${product.name} from ${data.buyerName}`,
                    farmName: product.farm?.name || 'Your Farm',
                    recommendation: `Buyer: ${data.buyerName}\n${data.buyerPhone ? 'Phone: ' + data.buyerPhone + '\n' : ''}${data.buyerEmail ? 'Email: ' + data.buyerEmail + '\n' : ''}Message: ${data.message}`,
                });
                inquiry.sentEmail = true;
            } catch (err) {
                logger.error(`Market inquiry email failed: ${err.message}`);
            }
        }

        await inquiry.save();
        return inquiry;
    }

    async getFarmerInquiries(farmerId) {
        return MarketInquiry.find({ farmer: farmerId })
            .populate('product', 'name price unit')
            .sort({ createdAt: -1 });
    }

    async markInquiryRead(inquiryId, farmerId) {
        return MarketInquiry.findOneAndUpdate(
            { _id: inquiryId, farmer: farmerId },
            { isRead: true, readAt: new Date() },
            { new: true }
        );
    }
}

module.exports = new MarketService();