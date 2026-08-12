const getAdminSettings = async () => {
    const Settings = require('../models/admin/Settings');
    let settings = await Settings.findOne();
    if (!settings) {
        settings = { system: { supportPhone: '+254700000000', supportEmail: 'support@farmvexa.com', appName: 'FarmVexa' } };
    }
    return settings;
};

const baseTemplate = (content, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const email = settings?.system?.supportEmail || 'support@farmvexa.com';
    const appName = settings?.system?.appName || 'FarmVexa';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}.container{max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)}.header{background:#2d6a4f;color:#fff;padding:30px;text-align:center}.header h1{margin:0;font-size:24px}.header p{margin:5px 0 0;font-size:14px;opacity:.9}.body{padding:30px;color:#333;line-height:1.6}.alert-high{border-left:4px solid #e74c3c;background:#fdf0ef;padding:15px;margin:15px 0;border-radius:4px}.alert-medium{border-left:4px solid #f39c12;background:#fef9e7;padding:15px;margin:15px 0;border-radius:4px}.alert-info{border-left:4px solid #3498db;background:#ebf5fb;padding:15px;margin:15px 0;border-radius:4px}.alert-success{border-left:4px solid #27ae60;background:#eafaf1;padding:15px;margin:15px 0;border-radius:4px}.button{display:inline-block;background:#2d6a4f;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;margin:15px 0}.footer{background:#f9f9f9;padding:20px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee}.footer p{margin:3px 0}.data-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}.data-label{font-weight:bold;color:#555}.data-value{color:#333}</style></head><body><div class="container"><div class="header"><h1>🌾 ${appName}</h1><p>AI-Powered Farm Intelligence</p></div><div class="body">${content}</div><div class="footer"><p><strong>${appName}</strong> - See. Sense. Predict. Grow.</p><p>📞 ${phone} | 📧 ${email}</p><p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p></div></div></body></html>`;
};

// ============ FARMER — REGISTRATION ============

const farmerRegistrationPending = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const email = settings?.system?.supportEmail || 'support@farmvexa.com';
    return { subject: '⏳ Your FarmVexa account is under review', html: baseTemplate(`<h2>Account Pending Approval</h2><div class="alert-info"><strong>Thank you for registering, ${user.name}!</strong><br>Your account is being reviewed.</div><p>You'll receive an email when approved.</p><p style="margin-top:15px;font-size:13px;color:#777">Questions? 📞 ${phone}<br>📧 ${email}</p>`, settings) };
};

const farmerApproved = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return { subject: '✅ Welcome to FarmVexa! Your account is approved', html: baseTemplate(`<h2>🎉 You're Approved, ${user.name}!</h2><div class="alert-success"><strong>Your account is now active.</strong></div><p>You can now:</p><ul><li>📡 Connect IoT sensors</li><li>📸 Scan crops for diseases</li><li>🤖 Chat with AI</li><li>📊 View dashboards</li></ul><a href="${process.env.CLIENT_URL}/login" class="button">Login to Dashboard</a><p style="margin-top:15px;font-size:13px;color:#777">Need help? 📞 ${phone}</p>`, settings) };
};

const farmerRejected = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const email = settings?.system?.supportEmail || 'support@farmvexa.com';
    return { subject: 'Update regarding your FarmVexa registration', html: baseTemplate(`<h2>Registration Update</h2><div class="alert-high"><strong>Hello ${user.name},</strong><br>Your registration was not approved.</div><div class="data-row"><span class="data-label">Reason:</span><span class="data-value">${data.reason || user.rejectionReason || 'No reason'}</span></div><p>📞 ${phone}<br>📧 ${email}</p>`, settings) };
};

// ============ FARMER — ACCOUNT ============

const farmerWelcome = async (user, data, settings) => ({
    subject: `Welcome to FarmVexa, ${user.name}! 🌾`, html: baseTemplate(`<h2>Welcome, ${user.name}! 👋</h2><div class="alert-success"><strong>Your account is ready!</strong></div><a href="${process.env.CLIENT_URL}/login" class="button">Go to Dashboard</a>`, settings) });

const farmerEmailVerify = async (user, data, settings) => ({
    subject: 'Verify Your FarmVexa Email', html: baseTemplate(`<h2>Verify Your Email</h2><a href="${process.env.CLIENT_URL}/verify-email/${data.token || ''}" class="button">Verify Email</a>`, settings) });

const farmerPasswordReset = async (user, data, settings) => ({
    subject: 'FarmVexa - Password Reset', html: baseTemplate(`<h2>Password Reset</h2><a href="${data.resetUrl || ''}" class="button">Reset Password</a><p style="font-size:13px;color:#777">Link expires in 30 minutes.</p>`, settings) });

// ============ FARMER — ALERTS ============

const farmerAlertHigh = async (user, data, settings) => ({
    subject: `🔴 HIGH RISK ALERT - ${data.farmName || 'Your Farm'}`, html: baseTemplate(`<h2>🔴 High Risk Alert</h2><div class="alert-high"><strong>${data.message}</strong></div><div class="data-row"><span class="data-label">Farm:</span><span class="data-value">${data.farmName || 'N/A'}</span></div><div class="data-row"><span class="data-label">Severity:</span><span class="data-value">HIGH</span></div>${data.recommendation?`<div class="data-row"><span class="data-label">Action:</span><span class="data-value">${data.recommendation}</span></div>`:''}<a href="${process.env.CLIENT_URL}/alerts" class="button">View Alert</a>`, settings) });

const farmerAlertMedium = async (user, data, settings) => ({
    subject: `🟡 MEDIUM ALERT - ${data.farmName || 'Your Farm'}`, html: baseTemplate(`<h2>🟡 Medium Alert</h2><div class="alert-medium"><strong>${data.message}</strong></div><a href="${process.env.CLIENT_URL}/alerts" class="button">View Details</a>`, settings) });

const farmerDiseaseDetected = async (user, data, settings) => ({
    subject: `🦠 Disease Detected: ${data.disease} - ${data.farmName || 'Your Farm'}`, html: baseTemplate(`<h2>🦠 Crop Disease Detected</h2><div class="alert-high"><strong>${data.disease}</strong> (${data.confidence}%)</div><div class="data-row"><span class="data-label">Farm:</span><span class="data-value">${data.farmName || 'N/A'}</span></div><div class="data-row"><span class="data-label">Crop:</span><span class="data-value">${data.cropType || 'N/A'}</span></div>${data.recommendation?`<div class="data-row"><span class="data-label">Action:</span><span class="data-value">${data.recommendation}</span></div>`:''}<a href="${process.env.CLIENT_URL}/crops" class="button">View Analysis</a>`, settings) });

const farmerDeviceOffline = async (user, data, settings) => ({
    subject: `📡 Device Offline - ${data.deviceId || 'Unknown'}`, html: baseTemplate(`<h2>📡 Device Offline</h2><div class="alert-medium"><strong>Device ${data.deviceId || 'Unknown'} is offline.</strong></div><div class="data-row"><span class="data-label">Last Seen:</span><span class="data-value">${data.lastSeen || 'Unknown'}</span></div><a href="${process.env.CLIENT_URL}/devices" class="button">Check Device</a>`, settings) });

// ============ FARMER — REPORTS ============

const farmerDailyReport = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const milkChange = data.yesterdayMilk > 0 ? ((data.todayMilk - data.yesterdayMilk) / data.yesterdayMilk * 100).toFixed(1) : 0;
    const eggChange = data.yesterdayEggs > 0 ? ((data.todayEggs - data.yesterdayEggs) / data.yesterdayEggs * 100).toFixed(1) : 0;

    return {
        subject: `📊 Daily Farm Report — ${data.farmName || 'Your Farm'}`,
        html: baseTemplate(`
            <h2>📊 Daily Farm Report</h2>
            <p>Your farm summary for ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            
            <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">🌤️ Weather</h3>
                <div class="data-row"><span class="data-label">Temperature:</span><span class="data-value">${data.avgTemp || 'N/A'}°C</span></div>
                <div class="data-row"><span class="data-label">Humidity:</span><span class="data-value">${data.avgHumidity || 'N/A'}%</span></div>
            </div>

            <div style="background:#eff6ff;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">🥛 Production Today</h3>
                <div class="data-row"><span class="data-label">🥛 Milk:</span><span class="data-value">${data.todayMilk || 0}L ${Number(milkChange) >= 0 ? '↑' : '↓'} ${Math.abs(milkChange)}% vs yesterday</span></div>
                <div class="data-row"><span class="data-label">🥚 Eggs:</span><span class="data-value">${data.todayEggs || 0} pcs ${Number(eggChange) >= 0 ? '↑' : '↓'} ${Math.abs(eggChange)}% vs yesterday</span></div>
            </div>

            <div style="background:#fefce8;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">📡 Farm Overview</h3>
                <div class="data-row"><span class="data-label">🐄 Animals:</span><span class="data-value">${data.animalCount || 0} active</span></div>
                <div class="data-row"><span class="data-label">⚠️ Alerts:</span><span class="data-value">${data.alertsCount || 0} unread</span></div>
                <div class="data-row"><span class="data-label">🟢 Health Score:</span><span class="data-value">${data.healthScore || 'N/A'}%</span></div>
            </div>

            ${data.deviceList && data.deviceList.length > 0 ? `
            <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">📡 Devices (${data.onlineDevices || 0}/${data.totalDevices || 0} online)</h3>
                ${data.deviceList.map((d) => `
                    <div class="data-row">
                        <span class="data-label">${d.name}</span>
                        <span class="data-value" style="color:${d.status === 'online' ? '#059669' : '#dc2626'}">
                            ${d.status === 'online' ? '🟢 Online' : '🔴 Offline'} ${d.battery ? '· ' + d.battery + '%' : ''}
                            ${d.lastSeen && d.status !== 'online' ? ' · Last seen: ' + new Date(d.lastSeen).toLocaleString('en-KE') : ''}
                        </span>
                    </div>
                `).join('')}
            </div>` : ''}

            ${data.sensorReadings ? `
            <div style="background:#f5f3ff;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">🌱 Sensor Readings (Latest)</h3>
                <div class="data-row"><span class="data-label">🌡️ Temperature:</span><span class="data-value">${data.sensorReadings.temperature || 'N/A'}°C</span></div>
                <div class="data-row"><span class="data-label">💧 Humidity:</span><span class="data-value">${data.sensorReadings.humidity || 'N/A'}%</span></div>
                <div class="data-row"><span class="data-label">🌱 Soil Moisture:</span><span class="data-value">${data.sensorReadings.soilMoisture || 'N/A'}%</span></div>
                <div class="data-row"><span class="data-label">☀️ Light Level:</span><span class="data-value">${data.sensorReadings.lightLevel || 'N/A'}</span></div>
            </div>` : ''}

            <a href="${process.env.CLIENT_URL}/dashboard" class="button">View Full Dashboard</a>
            <p style="margin-top:15px;font-size:13px;color:#777">Need help? 📞 ${phone}</p>
        `, settings),
    };
};

const farmerReminderUpcoming = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return {
        subject: `⏰ Upcoming Reminders — ${data.farmName || 'Your Farm'} (${data.count || 0} items)`,
        html: baseTemplate(`
            <h2>⏰ Upcoming Reminders</h2>
            <p>These items need your attention in the next 3 days on <strong>${data.farmName || 'your farm'}</strong>:</p>
            
            ${(data.reminders || []).map((r) => `
                <div style="background:#fef9e7;padding:12px;border-radius:8px;margin:8px 0;border-left:4px solid #f59e0b;">
                    <strong>${r.title}</strong>
                    <p style="margin:4px 0;font-size:13px;">${r.description || ''}</p>
                    <span style="font-size:12px;color:#f59e0b;">Due: ${new Date(r.dueDate).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} (${r.days} day${r.days > 1 ? 's' : ''} remaining)</span>
                </div>
            `).join('')}

            <a href="${process.env.CLIENT_URL}/operations" class="button">View Details</a>
            <p style="margin-top:15px;font-size:13px;color:#777">Need help? 📞 ${phone}</p>
        `, settings),
    };
};

const farmerReminderFinal = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return {
        subject: `🔴 Action Required TODAY — ${data.farmName || 'Your Farm'} (${data.count || 0} items)`,
        html: baseTemplate(`
            <h2>🔴 Action Required Today</h2>
            <p>These items are due <strong>TODAY</strong> on <strong>${data.farmName || 'your farm'}</strong>:</p>
            
            ${(data.reminders || []).map((r) => `
                <div style="background:#fdf0ef;padding:12px;border-radius:8px;margin:8px 0;border-left:4px solid #e74c3c;">
                    <strong>${r.title}</strong>
                    <p style="margin:4px 0;font-size:13px;">${r.description || ''}</p>
                    <span style="font-size:12px;color:#e74c3c;">⚠️ Due Today — ${new Date(r.dueDate).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            `).join('')}

            <p style="font-weight:bold;color:#e74c3c;">Please take action immediately.</p>
            <a href="${process.env.CLIENT_URL}/operations" class="button">View Details</a>
            <p style="margin-top:15px;font-size:13px;color:#777">Need help? 📞 ${phone}</p>
        `, settings),
    };
};

const farmerWeeklyReport = async (user, data, settings) => ({
    subject: `📈 Weekly Farm Report - ${data.farmName || 'Your Farm'}`, html: baseTemplate(`<h2>📈 Weekly Report</h2><div class="data-row"><span class="data-label">🟢 Health:</span><span class="data-value">${data.avgHealthScore || 'N/A'}%</span></div><div class="data-row"><span class="data-label">⚠️ Alerts:</span><span class="data-value">${data.totalAlerts || 0}</span></div><div class="data-row"><span class="data-label">📸 Scans:</span><span class="data-value">${data.cropScans || 0}</span></div><a href="${process.env.CLIENT_URL}/dashboard" class="button">View Report</a>`, settings) });

const farmerNewDeviceLogin = async (user, data, settings) => ({
    subject: '🔐 New Device Login - FarmVexa', html: baseTemplate(`<h2>🔐 New Device Login</h2><p>Your account was accessed from a new device.</p><div class="data-row"><span class="data-label">Browser:</span><span class="data-value">${data.browser || 'Unknown'}</span></div><div class="data-row"><span class="data-label">Time:</span><span class="data-value">${new Date().toLocaleString('en-KE')}</span></div>`, settings) });

// ============ FARMER — NEW (Livestock, Health, Assets, Weather) ============

const farmerVaccinationDue = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const urgency = data.daysLeft <= 1 ? 'alert-high' : data.daysLeft <= 3 ? 'alert-medium' : 'alert-info';
    const icon = data.daysLeft <= 1 ? '🔴' : data.daysLeft <= 3 ? '🟡' : '🔵';
    const urgencyText = data.daysLeft <= 1 ? 'URGENT' : data.daysLeft <= 3 ? 'Due Soon' : 'Upcoming';
    return { subject: `${icon} Vaccination ${urgencyText}: ${data.animalName || 'Animal'} - ${data.daysLeft === 0 ? 'TODAY' : data.daysLeft + ' day(s)'}`, html: baseTemplate(`<h2>${icon} Vaccination ${urgencyText}</h2><div class="${urgency}"><strong>${data.vaccineType || 'Vaccine'} due for ${data.animalName || 'animal'}</strong></div><div class="data-row"><span class="data-label">Animal:</span><span class="data-value">${data.animalName || 'N/A'} (${data.tagId || ''})</span></div><div class="data-row"><span class="data-label">Vaccine:</span><span class="data-value">${data.vaccineType || 'N/A'}</span></div><div class="data-row"><span class="data-label">Due Date:</span><span class="data-value">${data.dueDate || 'N/A'}</span></div><div class="data-row"><span class="data-label">Days Left:</span><span class="data-value" style="color:${data.daysLeft<=1?'#e74c3c':data.daysLeft<=3?'#f39c12':'#3498db'};font-weight:bold">${data.daysLeft===0?'TODAY!':data.daysLeft+' days'}</span></div>${data.vetName?`<div class="data-row"><span class="data-label">Vet:</span><span class="data-value">${data.vetName} (${data.vetContact||'N/A'})</span></div>`:''}<a href="${process.env.CLIENT_URL}/health" class="button">View Health Records</a><p style="margin-top:15px;font-size:13px;color:#777">Need a vet? 📞 ${phone}</p>`, settings) };
};

const farmerLivestockAlert = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return { subject: `🐄 Livestock Alert: ${data.animalName || 'Animal'}`, html: baseTemplate(`<h2>🐄 Livestock Alert</h2><div class="alert-high"><strong>${data.message}</strong></div><div class="data-row"><span class="data-label">Animal:</span><span class="data-value">${data.animalName||'N/A'} (${data.tagId||''})</span></div><div class="data-row"><span class="data-label">Type:</span><span class="data-value">${data.recordType||'N/A'}</span></div>${data.recommendation?`<div class="data-row"><span class="data-label">Action:</span><span class="data-value">${data.recommendation}</span></div>`:''}<a href="${process.env.CLIENT_URL}/health" class="button">View Details</a><p style="margin-top:15px;font-size:13px;color:#777">📞 ${phone}</p>`, settings) };
};

const farmerLowStock = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return { subject: `📦 Low Stock Alert: ${data.itemName}`, html: baseTemplate(`<h2>📦 Low Stock Alert</h2><div class="alert-medium"><strong>${data.itemName} is running low.</strong></div><div class="data-row"><span class="data-label">Item:</span><span class="data-value">${data.itemName}</span></div><div class="data-row"><span class="data-label">Remaining:</span><span class="data-value">${data.quantity} ${data.unit||''}</span></div><div class="data-row"><span class="data-label">Threshold:</span><span class="data-value">${data.lowStockAlert} ${data.unit||''}</span></div><a href="${process.env.CLIENT_URL}/operations" class="button">Manage Inventory</a><p style="margin-top:15px;font-size:13px;color:#777">📞 ${phone}</p>`, settings) };
};

const farmerMaintenanceDue = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return { subject: `🔧 Maintenance Due: ${data.equipmentName}`, html: baseTemplate(`<h2>🔧 Maintenance Due</h2><div class="alert-info"><strong>${data.equipmentName} needs maintenance.</strong></div><div class="data-row"><span class="data-label">Equipment:</span><span class="data-value">${data.equipmentName}</span></div><div class="data-row"><span class="data-label">Next Service:</span><span class="data-value">${data.nextMaintenance||'N/A'}</span></div><a href="${process.env.CLIENT_URL}/operations" class="button">View Equipment</a><p style="margin-top:15px;font-size:13px;color:#777">📞 ${phone}</p>`, settings) };
};

const farmerWeatherAlert = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const icon = { rain:'🌧️', drought:'🏜️', frost:'❄️', storm:'⛈️', heatwave:'🔥' }[data.type] || '⚠️';
    return { subject: `${icon} Weather Alert: ${data.type} - ${data.farmName||'Your Farm'}`, html: baseTemplate(`<h2>${icon} Weather Alert</h2><div class="${data.severity==='high'?'alert-high':'alert-medium'}"><strong>${data.message}</strong></div>${data.recommendation?`<div class="data-row"><span class="data-label">Recommendation:</span><span class="data-value">${data.recommendation}</span></div>`:''}<a href="${process.env.CLIENT_URL}/weather" class="button">View Weather</a><p style="margin-top:15px;font-size:13px;color:#777">📞 ${phone}</p>`, settings) };
};

const farmerTaskOverdue = async (user, data, settings) => ({
    subject: `⏰ Task Overdue: ${data.title}`, html: baseTemplate(`<h2>⏰ Task Overdue</h2><div class="alert-high"><strong>${data.title}</strong> is past due.</div><div class="data-row"><span class="data-label">Due Date:</span><span class="data-value">${data.dueDate||'N/A'}</span></div><div class="data-row"><span class="data-label">Priority:</span><span class="data-value">${data.priority||'N/A'}</span></div><a href="${process.env.CLIENT_URL}/operations" class="button">View Tasks</a>`, settings) });

const teamMemberAdded = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return { subject: `Welcome to FarmVexa, ${user.name}!`, html: baseTemplate(`<h2>Welcome to the Team! 👋</h2><div class="alert-success"><strong>You've been added as ${data.role||'team member'}.</strong></div><div class="data-row"><span class="data-label">Farm:</span><span class="data-value">${data.farmName||'N/A'}</span></div><div class="data-row"><span class="data-label">Role:</span><span class="data-value">${data.role||'N/A'}</span></div><p style="margin-top:15px"><strong>Your Login Credentials:</strong></p><div class="data-row"><span class="data-label">Email:</span><span class="data-value">${data.email||user.email}</span></div><div class="data-row"><span class="data-label">Password:</span><span class="data-value">${data.password||'N/A'}</span></div><p style="font-size:13px;color:#e74c3c">Please change your password after first login.</p><a href="${process.env.CLIENT_URL}/login" class="button">Login to FarmVexa</a><p style="margin-top:15px;font-size:13px;color:#777">Need help? 📞 ${phone}</p>`, settings) };
};

// ============ ADMIN ============

const adminNewFarmer = async (user, data, settings) => ({
    subject: `👨‍🌾 New Farmer: ${data.farmer?.name || 'Unknown'}`, html: baseTemplate(`<h2>👨‍🌾 New Farmer Pending</h2><div class="data-row"><span class="data-label">Name:</span><span class="data-value">${data.farmer?.name||'N/A'}</span></div><div class="data-row"><span class="data-label">Email:</span><span class="data-value">${data.farmer?.email||'N/A'}</span></div><div class="data-row"><span class="data-label">Phone:</span><span class="data-value">${data.farmer?.phone||'N/A'}</span></div><a href="${process.env.ADMIN_URL}/approvals" class="button">Review & Approve</a>`, settings) });

const adminSystemCritical = async (user, data, settings) => ({
    subject: '🚨 CRITICAL SYSTEM ALERT', html: baseTemplate(`<h2>🚨 Critical Alert</h2><div class="alert-high"><strong>${data.message||'System error'}</strong></div><p>Immediate attention required.</p>`, settings) });

const adminGeminiEightyPercent = async (user, data, settings) => ({
    subject: '⚠️ Gemini API at 80%', html: baseTemplate(`<h2>⚠️ Usage Warning</h2><div class="alert-medium"><strong>Daily limit at 80%</strong></div><div class="data-row"><span class="data-label">Today:</span><span class="data-value">${data.requestsToday||0}</span></div><a href="${process.env.ADMIN_URL}/settings" class="button">Manage Limits</a>`, settings) });

const adminGeminiExceeded = async (user, data, settings) => ({
    subject: '🚫 Gemini API Limit Exceeded', html: baseTemplate(`<h2>🚫 Limit Exceeded</h2><div class="alert-high"><strong>Daily limit of ${data.dailyLimit||0} reached.</strong></div><a href="${process.env.ADMIN_URL}/settings" class="button">Increase Limit</a>`, settings) });

const adminPythonOffline = async (user, data, settings) => ({
    subject: '🔴 Python AI Engine Offline', html: baseTemplate(`<h2>🔴 Python AI Offline</h2><div class="alert-high"><strong>AI Engine not responding.</strong></div><p>AI features unavailable.</p>`, settings) });

const adminDeviceOffline24h = async (user, data, settings) => ({
    subject: `📡 Device Offline 24h+ - ${data.deviceId||'Unknown'}`, html: baseTemplate(`<h2>📡 Device Offline 24h+</h2><div class="data-row"><span class="data-label">Device:</span><span class="data-value">${data.deviceId||'Unknown'}</span></div><a href="${process.env.ADMIN_URL}/devices" class="button">Check Devices</a>`, settings) });

const adminTrainingComplete = async (user, data, settings) => ({
    subject: `✅ Training Complete - ${data.name||'Model'}`, html: baseTemplate(`<h2>✅ Training Complete</h2><div class="alert-success"><strong>${data.name||'Model'} v${data.version||'1.0'} ready.</strong></div><div class="data-row"><span class="data-label">Accuracy:</span><span class="data-value">${data.accuracy||'N/A'}%</span></div><a href="${process.env.ADMIN_URL}/models" class="button">Deploy</a>`, settings) });

const adminNewAdmin = async (user, data, settings) => ({
    subject: '🛠️ New Admin Created', html: baseTemplate(`<h2>🛠️ New Admin</h2><div class="data-row"><span class="data-label">Name:</span><span class="data-value">${data.name}</span></div><div class="data-row"><span class="data-label">Role:</span><span class="data-value">${data.role||'admin'}</span></div>`, settings) });

const adminWeeklyReport = async (user, data, settings) => ({
    subject: '📊 Weekly System Report', html: baseTemplate(`<h2>📊 Weekly Report</h2><div class="data-row"><span class="data-label">👨‍🌾 Farmers:</span><span class="data-value">${data.totalFarmers||0}</span></div><div class="data-row"><span class="data-label">🌾 Farms:</span><span class="data-value">${data.totalFarms||0}</span></div><div class="data-row"><span class="data-label">📸 Scans:</span><span class="data-value">${data.cropScans||0}</span></div><a href="${process.env.ADMIN_URL}" class="button">View Dashboard</a>`, settings) });

module.exports = {
    farmerRegistrationPending, farmerApproved, farmerRejected, farmerWelcome,
    farmerEmailVerify, farmerPasswordReset,
    farmerAlertHigh, farmerAlertMedium, farmerDiseaseDetected, farmerDeviceOffline,
    farmerDailyReport, farmerWeeklyReport, farmerNewDeviceLogin,
    farmerVaccinationDue, farmerLivestockAlert, farmerLowStock,
    farmerMaintenanceDue, farmerWeatherAlert, farmerTaskOverdue,
    teamMemberAdded,
    adminNewFarmer, adminSystemCritical, adminGeminiEightyPercent,
    adminGeminiExceeded, adminPythonOffline, adminDeviceOffline24h,
    adminTrainingComplete, adminNewAdmin, adminWeeklyReport,
    farmerReminderUpcoming,farmerReminderFinal,

};