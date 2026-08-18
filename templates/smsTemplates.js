const getAdminSettings = async () => {
    const Settings = require('../models/admin/Settings');
    let settings = await Settings.findOne();
    if (!settings) settings = { system: { supportPhone: '+254700000000', appName: 'FarmVexa' } };
    return settings;
};

// ============ FARMER — REGISTRATION ============

const farmerRegistrationPending = async (user, data, settings) =>
    `FarmVexa: Registration received! Plan: ${data.planName || 'N/A'} (KES ${data.amount || 0}). We'll verify payment and approve within 24 hours. Help: ${settings?.system?.supportPhone || '+254700000000'}`;

const farmerAutoRejected = async (user, data, settings) =>
    `FarmVexa: Registration expired. No payment received within 3 hours. Register again: ${process.env.CLIENT_URL}/register. Help: ${settings?.system?.supportPhone || '+254700000000'}`;

const farmerApproved = async (user, data, settings) =>
    `FarmVexa: Welcome ${user.name}! Your account is approved${data.planName ? ` (${data.planName} plan)` : ''}. Login at ${process.env.CLIENT_URL}/login. Help: ${settings?.system?.supportPhone || '+254700000000'}`;

const farmerRejected = async (user, data, settings) =>
    `FarmVexa: Registration update for ${user.name}. Reason: ${data.reason || 'Not approved'}. Contact: ${settings?.system?.supportPhone || '+254700000000'}`;

const farmerWelcome = async (user, data, settings) =>
    `Welcome to FarmVexa ${user.name}! Login: ${process.env.CLIENT_URL}/login. Help: ${settings.system?.supportPhone}`;

// ============ FARMER — ALERTS ============

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

const farmerStorageAlert = async (user, data, settings) => {
    const parts = [`${data.message}`, `${data.farmName || 'Your Farm'}`];
    
    if (data.temperature) parts.push(`Temp: ${data.temperature}°C`);
    if (data.humidity) parts.push(`Humidity: ${data.humidity}%`);
    if (data.co2) parts.push(`CO2: ${data.co2}ppm`);
    if (data.recommendation) parts.push(data.recommendation);
    
    return parts.join('\n');
};

// ============ TEAM & MARKET ============

const teamMemberAdded = async (user, data, settings) =>
    `FarmVexa: You've been added as ${data.role} on ${data.farmName}. Login: ${process.env.CLIENT_URL}/login Email: ${data.email||user.email} Pass: ${data.password}`;

const marketInquirySMS = async (user, data, settings) =>
    `FarmVexa Market: New inquiry for ${data.productName} from ${data.buyerName}${data.buyerPhone ? ' (' + data.buyerPhone + ')' : ''}. ${data.message ? data.message.substring(0, 80) : ''}`;

// ============ ADMIN ============

const adminNewFarmer = async (user, data, settings) =>
    `FARMVEXA: New farmer ${data.farmer?.name || data.name} (${data.farmer?.email || data.email}) pending${data.planName ? ` - ${data.planName} plan` : ''}. Review: ${process.env.ADMIN_URL}/approvals`;

const adminPaymentReceived = async (user, data, settings) =>
    `FARMVEXA: Payment received from ${data.farmer?.name || data.name} (${data.planName}) KES ${data.amount}. Ref: ${data.reference || 'N/A'}. Verify: ${process.env.ADMIN_URL}/approvals`;

const adminSystemCritical = async (user, data, settings) =>
    `FARMVEXA CRITICAL: ${data.message?.substring(0,100)}. Check immediately. ${settings?.system?.supportPhone||'+254700000000'}`;

const adminGeminiExceeded = async (user, data, settings) =>
    `FARMVEXA: Gemini limit exceeded (${data.dailyLimit}). Users blocked. Update: ${process.env.ADMIN_URL}/settings`;

const adminPythonOffline = async (user, data, settings) =>
    `FARMVEXA CRITICAL: Python AI offline. AI features down. Check: ${process.env.PYTHON_AI_URL}`;


// ============ FARMER — RENEWAL ============

const farmerRenewalReceived = async (user, data, settings) =>
    `FarmVexa: Renewal received! Plan: ${data.planName} (KES ${data.amount}). We'll verify and approve within 24 hours. Help: ${settings?.system?.supportPhone || '+254700000000'}`;

const farmerRenewalApproved = async (user, data, settings) =>
    `FarmVexa: Renewal approved! Your ${data.planName} plan is active until ${data.newExpiry ? new Date(data.newExpiry).toLocaleDateString('en-KE') : 'N/A'}. Help: ${settings?.system?.supportPhone || '+254700000000'}`;

const farmerRenewalRejected = async (user, data, settings) =>
    `FarmVexa: Renewal not approved. Reason: ${data.reason || 'No reason'}. Contact: ${settings?.system?.supportPhone || '+254700000000'}`;

const farmerRenewalAutoRejected = async (user, data, settings) =>
    `FarmVexa: Renewal expired. No payment received within 3 hours. Try again: ${process.env.CLIENT_URL}/renewal`;

const adminRenewalRequest = async (user, data, settings) =>
    `FARMVEXA: Renewal request from ${data.farmer?.name || data.name} (${data.planName}) KES ${data.amount}. Ref: ${data.reference || 'N/A'}. Verify: ${process.env.ADMIN_URL}/approvals`;

// ============ FARMER — SUBSCRIPTION REMINDERS ============

const farmerSubscriptionExpiring10d = async (user, data, settings) =>
    `FarmVexa: Your ${data.planName || 'monthly'} subscription expires in 10 days (${data.expiryDate ? new Date(data.expiryDate).toLocaleDateString('en-KE') : 'N/A'}). Renew early to avoid interruption: ${process.env.CLIENT_URL}/renewal`;

const farmerSubscriptionExpiring3d = async (user, data, settings) =>
    `FarmVexa URGENT: Your ${data.planName || 'monthly'} subscription expires in 3 DAYS! Access will be blocked. Renew now: ${process.env.CLIENT_URL}/renewal`;

const farmerSubscriptionExpired = async (user, data, settings) =>
    `FarmVexa: Your ${data.planName || 'monthly'} subscription has EXPIRED. Access blocked. Renew now: ${process.env.CLIENT_URL}/renewal. Help: ${settings?.system?.supportPhone || '+254700000000'}`;


// ============ FARMER — UPGRADE ============

const farmerUpgradeReceived = async (user, data, settings) =>
    `FarmVexa: Upgrade request received! ${data.oldPlan} → ${data.newPlan} (KES ${data.amount}). We'll verify and approve within 24 hours. Help: ${settings?.system?.supportPhone || '+254700000000'}`;

const farmerUpgradeApproved = async (user, data, settings) =>
    `FarmVexa: Upgrade approved! You're now on ${data.newPlan} plan. Login: ${process.env.CLIENT_URL}/login. Help: ${settings?.system?.supportPhone || '+254700000000'}`;

const farmerUpgradeRejected = async (user, data, settings) =>
    `FarmVexa: Upgrade not approved. Reason: ${data.reason || 'No reason'}. You remain on your current plan. Contact: ${settings?.system?.supportPhone || '+254700000000'}`;

const adminUpgradeRequest = async (user, data, settings) =>
    `FARMVEXA: Upgrade request from ${data.farmer?.name || data.name} (${data.oldPlan} → ${data.newPlan}) KES ${data.amount}. Ref: ${data.reference || 'N/A'}. Verify: ${process.env.ADMIN_URL}/approvals`;

module.exports = {
    farmerRegistrationPending, farmerAutoRejected, farmerApproved, farmerRejected, farmerWelcome,
    farmerAlertHigh, farmerDiseaseDetected,
    farmerDeviceOffline, farmerVaccinationDue, farmerLivestockAlert, farmerStorageAlert,
    farmerLowStock, farmerWeatherAlert, teamMemberAdded, marketInquirySMS,
    adminNewFarmer, adminPaymentReceived, adminSystemCritical, adminGeminiExceeded, adminPythonOffline,
    farmerRenewalReceived, farmerRenewalApproved, farmerRenewalRejected, farmerRenewalAutoRejected,
    adminRenewalRequest,
    farmerSubscriptionExpiring10d, farmerSubscriptionExpiring3d, farmerSubscriptionExpired,
    farmerUpgradeReceived, farmerUpgradeApproved, farmerUpgradeRejected,
    adminUpgradeRequest,
};