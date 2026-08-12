const Animal = require('../../models/farm/Animal');
const HealthRecord = require('../../models/farm/HealthRecord');
const ProductionRecord = require('../../models/farm/ProductionRecord');
const Inventory = require('../../models/farm/Inventory');
const Stock = require('../../models/farm/Stock');
const Equipment = require('../../models/farm/Equipment');
const Transaction = require('../../models/farm/Transaction');
const Task = require('../../models/farm/Task');
const Field = require('../../models/farm/Field');
const TeamMember = require('../../models/farm/TeamMember');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getReport = asyncHandler(async (req, res) => {
    const { type, startDate, endDate } = req.query;
    const farmId = req.params.farmId;

    const sDate = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const eDate = endDate ? new Date(endDate) : new Date();
    sDate.setHours(0, 0, 0, 0);
    eDate.setHours(23, 59, 59, 999);

    let items = [];
    let summary = {};

    switch (type) {
        case 'general': {
            const [animals, fields, stockItems, invItems, equipment, team, tasks] = await Promise.all([
                Animal.countDocuments({ farm: farmId }),
                Field.countDocuments({ farm: farmId }),
                Stock.find({ farm: farmId }),
                Inventory.find({ farm: farmId }),
                Equipment.countDocuments({ farm: farmId }),
                TeamMember.countDocuments({ farm: farmId, status: 'active' }),
                Task.countDocuments({ farm: farmId, status: { $in: ['pending', 'in_progress'] } }),
            ]);
            const stockTotal = stockItems.reduce((s, i) => s + i.quantity * i.pricePerUnit, 0);
            const invTotal = invItems.reduce((s, i) => s + (i.quantity || 0) * (i.cost || 0), 0);
            summary = {
                animals, fields, stockItems: stockItems.length, stockValue: stockTotal,
                inventoryItems: invItems.length, inventoryValue: invTotal,
                equipment, team, pendingTasks: tasks,
            };
            break;
        }
        case 'stock': {
            const stockItems = await Stock.find({ farm: farmId });
            const lowStock = stockItems.filter((i) => i.minimumStock > 0 && i.quantity <= i.minimumStock);
            const totalValue = stockItems.reduce((s, i) => s + i.quantity * (i.pricePerUnit || 0), 0);
            items = stockItems;
            summary = { total: stockItems.length, lowStock: lowStock.length, totalValue };
            break;
        }
        case 'livestock': {
            const animals = await Animal.find({ farm: farmId });
            const byType = {}, byStatus = {};
            animals.forEach((a) => { byType[a.type] = (byType[a.type] || 0) + 1; byStatus[a.status] = (byStatus[a.status] || 0) + 1; });
            items = animals;
            summary = { total: animals.length, active: byStatus.active || 0, sold: byStatus.sold || 0, dead: byStatus.dead || 0, ...byType };
            break;
        }
        case 'production': {
            const records = await ProductionRecord.find({ farm: farmId, date: { $gte: sDate, $lte: eDate } }).populate('animal', 'tagId name');
            const byType = {}; let totalValue = 0;
            records.forEach((r) => { byType[r.type] = (byType[r.type] || 0) + (r.quantity || 0); totalValue += r.totalValue || 0; });
            items = records;
            summary = { records: records.length, totalValue, ...byType };
            break;
        }
        case 'crops': {
            const fields = await Field.find({ farm: farmId });
            const active = fields.filter((f) => f.crop && f.status === 'active').length;
            const harvested = fields.filter((f) => f.status === 'harvested').length;
            const fallow = fields.filter((f) => f.status === 'fallow').length;
            items = fields;
            summary = { total: fields.length, active, harvested, fallow };
            break;
        }
        case 'financial': {
            const transactions = await Transaction.find({ farm: farmId, date: { $gte: sDate, $lte: eDate } });
            const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
            items = transactions;
            summary = { income, expense, net: income - expense, transactions: transactions.length };
            break;
        }
        case 'vaccination': {
            const records = await HealthRecord.find({ farm: farmId, recordType: 'vaccination' }).populate('animal', 'tagId');
            const upcoming = records.filter((r) => r.nextCheckup && new Date(r.nextCheckup) >= new Date()).length;
            const overdue = records.filter((r) => r.nextCheckup && new Date(r.nextCheckup) < new Date()).length;
            items = records;
            summary = { total: records.length, upcoming, overdue };
            break;
        }
        case 'inventory': {
            const invItems = await Inventory.find({ farm: farmId });
            const lowStock = invItems.filter((i) => i.lowStockAlert && i.quantity <= i.lowStockAlert).length;
            const totalValue = invItems.reduce((s, i) => s + ((i.quantity || 0) * (i.cost || 0)), 0);
            items = invItems;
            summary = { total: invItems.length, lowStock, totalValue };
            break;
        }
        case 'tasks': {
            const tasks = await Task.find({ farm: farmId }).populate('assignedTo', 'name');
            const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
            const completed = tasks.filter((t) => t.status === 'completed').length;
            items = tasks;
            summary = { total: tasks.length, pending, completed };
            break;
        }
        default:
            return errorResponse(res, 'Invalid report type', 400);
    }

    return successResponse(res, { items, summary });
});

module.exports = { getReport };