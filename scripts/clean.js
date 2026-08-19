require('dotenv').config();
require('./dnsSet');

const mongoose = require('mongoose');

const User = require('../models/farm/User');
const Farm = require('../models/farm/Farm');
const Field = require('../models/farm/Field');
const Crop = require('../models/farm/Crop');
const CropImage = require('../models/farm/CropImage');
const Animal = require('../models/farm/Animal');
const HealthRecord = require('../models/farm/HealthRecord');
const ProductionRecord = require('../models/farm/ProductionRecord');
const Stock = require('../models/farm/Stock');
const Inventory = require('../models/farm/Inventory');
const Equipment = require('../models/farm/Equipment');
const Transaction = require('../models/farm/Transaction');
const ProductPrice = require('../models/farm/ProductPrice');
const Task = require('../models/farm/Task');
const TeamMember = require('../models/farm/TeamMember');
const Alert = require('../models/farm/Alert');
const Chat = require('../models/farm/Chat');
const Device = require('../models/farm/Device');
const SensorReading = require('../models/farm/SensorReading');
const FieldScan = require('../models/farm/FieldScan');
const Weather = require('../models/farm/Weather');
const MarketProduct = require('../models/farm/MarketProduct');
const MarketInquiry = require('../models/farm/MarketInquiry');
const NotificationLog = require('../models/farm/NotificationLog');
const PaymentRecord = require('../models/admin/PaymentRecord');
const PendingApproval = require('../models/admin/PendingApproval');

async function cleanOrphans() {
    console.log('🔍 Scanning for orphaned records...\n');

    // Get valid IDs
    const userIds = (await User.find().select('_id').lean()).map(u => u._id.toString());
    const farmIds = (await Farm.find().select('_id').lean()).map(f => f._id.toString());
    const fieldIds = (await Field.find().select('_id').lean()).map(f => f._id.toString());
    const deviceIds = (await Device.find().select('_id').lean()).map(d => d._id.toString());
    const productIds = (await MarketProduct.find().select('_id').lean()).map(p => p._id.toString());

    console.log(`Valid: ${userIds.length} users, ${farmIds.length} farms, ${fieldIds.length} fields, ${deviceIds.length} devices, ${productIds.length} products\n`);

    const results = {};

    // Farm-scoped
    results.crops = (await Crop.deleteMany({ field: { $nin: fieldIds } })).deletedCount;
    results.cropImages = (await CropImage.deleteMany({ field: { $nin: fieldIds } })).deletedCount;
    results.animals = (await Animal.deleteMany({ farm: { $nin: farmIds } })).deletedCount;
    results.healthRecords = (await HealthRecord.deleteMany({ farm: { $nin: farmIds } })).deletedCount;
    results.productionRecords = (await ProductionRecord.deleteMany({ farm: { $nin: farmIds } })).deletedCount;
    results.stock = (await Stock.deleteMany({ farm: { $nin: farmIds } })).deletedCount;
    results.inventory = (await Inventory.deleteMany({ farm: { $nin: farmIds } })).deletedCount;
    results.equipment = (await Equipment.deleteMany({ farm: { $nin: farmIds } })).deletedCount;
    results.transactions = (await Transaction.deleteMany({ farm: { $nin: farmIds } })).deletedCount;
    results.prices = (await ProductPrice.deleteMany({ farm: { $nin: farmIds } })).deletedCount;
    results.tasks = (await Task.deleteMany({ farm: { $nin: farmIds } })).deletedCount;
    results.alerts = (await Alert.deleteMany({ farm: { $nin: farmIds } })).deletedCount;
    results.devices = (await Device.deleteMany({ farm: { $nin: farmIds } })).deletedCount;
    results.weather = (await Weather.deleteMany({ farm: { $nin: farmIds } })).deletedCount;
    results.marketProducts = (await MarketProduct.deleteMany({ farm: { $nin: farmIds } })).deletedCount;

    // Device-scoped
    results.sensorReadings = (await SensorReading.deleteMany({ device: { $nin: deviceIds } })).deletedCount;

    // User-scoped
    results.fieldScans = (await FieldScan.deleteMany({ user: { $nin: userIds } })).deletedCount;
    results.chats = (await Chat.deleteMany({ user: { $nin: userIds } })).deletedCount;
    results.notifications = (await NotificationLog.deleteMany({ user: { $nin: userIds } })).deletedCount;
    results.payments = (await PaymentRecord.deleteMany({ user: { $nin: userIds } })).deletedCount;
    results.pendingApprovals = (await PendingApproval.deleteMany({ user: { $nin: userIds } })).deletedCount;

    // Team members — farm or user must exist
    results.teamMembers = (await TeamMember.deleteMany({
        $and: [
            { farm: { $nin: farmIds } },
            { user: { $nin: userIds } },
        ],
    })).deletedCount;

    // Market inquiries — product must exist
    results.marketInquiries = (await MarketInquiry.deleteMany({ product: { $nin: productIds } })).deletedCount;

    console.log('✅ Cleanup complete:\n');
    Object.entries(results).forEach(([key, count]) => {
        if (count > 0) {
            console.log(`  ${key}: ${count} deleted`);
        }
    });

    const totalDeleted = Object.values(results).reduce((sum, v) => sum + v, 0);
    console.log(`\n📊 Total deleted: ${totalDeleted}`);
}

mongoose.connect(process.env.MONGODB_URI)
    .then(() => cleanOrphans())
    .then(() => {
        console.log('\n✅ Done');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    });