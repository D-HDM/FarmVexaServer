const getAdminSettings = async () => {
    const Settings = require('../models/admin/Settings');
    let settings = await Settings.findOne();
    if (!settings) settings = { system: { supportPhone: '+254700000000', appName: 'FarmVexa' } };
    return settings;
};

const farmerApproved = async (user, data, settings) =>
    `FarmVexa: Welcome ${user.name}! Your account is approved. Login at ${process.env.CLIENT_URL}/login. Help: ${settings?.system?.supportPhone || '+254700000000'}`;

const farmerWelcome = async (user, data, settings) =>
    `Welcome to FarmVexa ${user.name}! Login: ${process.env.CLIENT_URL}/login. Help: ${settings.system?.supportPhone}`;

const farmerAlertHigh = async (user, data, settings) =>
    `FARMVEXA HIGH ALERT: ${data.message} (${data.farmName}). Action needed! ${process.env.CLIENT_URL}/alerts. Help: ${settings.system?.supportPhone}`;

const farmerDiseaseDetected = async (user, data, settings) =>
    `FARMVEXA: ${data.disease} on ${data.cropType} (${data.confidence}%). ${data.recommendation?.substring(0,80)}. Help: ${settings.system?.supportPhone}`;

const farmerDeviceOffline = async (user, data, settings) =>
    `FARMVEXA: Device ${data.deviceId} offline at ${data.farmName}. Check power/Wi-Fi. Support: ${settings.system?.supportPhone}`;

const farmerVaccinationDue = async (user, data, settings) =>
    `FarmVexa ${data.daysLeft<=1?'🔴URGENT':data.daysLeft<=3?'🟡':'🔵'}: ${data.vaccineType} due for ${data.animalName} ${data.daysLeft===0?'TODAY':'in '+data.daysLeft+' days'}. Date: ${data.dueDate}. Help: ${settings?.system?.supportPhone||'+254700000000'}`;

const farmerLivestockAlert = async (user, data, settings) =>
    `FARMVEXA: ${data.message} - ${data.animalName} (${data.tagId}). ${data.recommendation?.substring(0,80)}. Help: ${settings?.system?.supportPhone||'+254700000000'}`;

const farmerLowStock = async (user, data, settings) =>
    `FARMVEXA: Low stock! ${data.itemName} remaining: ${data.quantity} ${data.unit||''}. Reorder needed. ${process.env.CLIENT_URL}/operations`;

const farmerWeatherAlert = async (user, data, settings) =>
    `FARMVEXA WEATHER: ${data.message} for ${data.farmName||'your farm'}. ${data.recommendation?.substring(0,80)}. Help: ${settings?.system?.supportPhone||'+254700000000'}`;

const teamMemberAdded = async (user, data, settings) =>
    `FarmVexa: You've been added as ${data.role} on ${data.farmName}. Login: ${process.env.CLIENT_URL}/login Email: ${data.email||user.email} Pass: ${data.password}`;

const marketInquirySMS = async (user, data, settings) =>
    `FarmVexa Market: New inquiry for ${data.productName} from ${data.buyerName}${data.buyerPhone ? ' (' + data.buyerPhone + ')' : ''}. ${data.message ? data.message.substring(0, 80) : ''}`;

const adminNewFarmer = async (user, data, settings) =>
    `FARMVEXA: New farmer ${data.farmer?.name} (${data.farmer?.email}) pending. Review: ${process.env.ADMIN_URL}/approvals`;

const adminSystemCritical = async (user, data, settings) =>
    `FARMVEXA CRITICAL: ${data.message?.substring(0,100)}. Check immediately. ${settings?.system?.supportPhone||'+254700000000'}`;

const adminGeminiExceeded = async (user, data, settings) =>
    `FARMVEXA: Gemini limit exceeded (${data.dailyLimit}). Users blocked. Update: ${process.env.ADMIN_URL}/settings`;

const adminPythonOffline = async (user, data, settings) =>
    `FARMVEXA CRITICAL: Python AI offline. AI features down. Check: ${process.env.PYTHON_AI_URL}`;

module.exports = {
    farmerApproved, farmerWelcome, farmerAlertHigh, farmerDiseaseDetected,
    farmerDeviceOffline, farmerVaccinationDue, farmerLivestockAlert,
    farmerLowStock, farmerWeatherAlert, teamMemberAdded,marketInquirySMS,
    adminNewFarmer, adminSystemCritical, adminGeminiExceeded, adminPythonOffline,
};