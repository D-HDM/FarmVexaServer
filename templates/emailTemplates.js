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
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}.container{max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)}.header{background:#2d6a4f;color:#fff;padding:30px;text-align:center}.header h1{margin:0;font-size:24px}.header p{margin:5px 0 0;font-size:14px;opacity:.9}.body{padding:30px;color:#333;line-height:1.6}.alert-high{border-left:4px solid #e74c3c;background:#fdf0ef;padding:15px;margin:15px 0;border-radius:4px}.alert-medium{border-left:4px solid #f39c12;background:#fef9e7;padding:15px;margin:15px 0;border-radius:4px}.alert-info{border-left:4px solid #3498db;background:#ebf5fb;padding:15px;margin:15px 0;border-radius:4px}.alert-success{border-left:4px solid #27ae60;background:#eafaf1;padding:15px;margin:15px 0;border-radius:4px}.button{display:inline-block;background:#2d6a4f;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;margin:15px 0}.footer{background:#f9f9f9;padding:20px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee}.footer p{margin:3px 0}.data-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}.data-label{font-weight:bold;color:#555}.data-value{color:#333}.mono{font-family:monospace;background:#f1f5f9;padding:2px 6px;border-radius:4px}</style></head><body><div class="container"><div class="header"><h1>🌾 ${appName}</h1><p>AI-Powered Farm Intelligence</p></div><div class="body">${content}</div><div class="footer"><p><strong>${appName}</strong> - See. Sense. Predict. Grow.</p><p>📞 ${phone} | 📧 ${email}</p><p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p></div></div></body></html>`;
};

const methodLabels = {
    mpesa_stk: 'M-Pesa STK Push',
    mpesa_send: 'M-Pesa Send Money',
    mpesa_send_money: 'M-Pesa Send Money',
    mpesa_till: 'M-Pesa Till Number',
    mpesa_paybill: 'M-Pesa Paybill',
    bank: 'Bank Transfer',
    cash: 'Cash',
    card: 'Card Payment',
    manual: 'Manual Payment',
};

const renderInstructions = (paymentInstructions, invoiceUrl) => {
    const list = Array.isArray(paymentInstructions) ? paymentInstructions : [];

    if (list.length === 0) {
        if (!invoiceUrl) return '';
        return `
            <div style="background:#eff6ff;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #3b82f6;">
                <p style="margin:0 0 8px 0;font-weight:700;color:#1e40af;">💳 Complete Your Payment</p>
                <p style="margin:4px 0;font-size:13px;color:#1e40af;">Click the button below to view your invoice and choose a payment method.</p>
                <div style="text-align:center;margin:14px 0 4px 0;">
                    <a href="${invoiceUrl}" style="display:inline-block;background:#2d6a4f;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">
                        View Invoice &amp; Pay
                    </a>
                </div>
            </div>`;
    }

    return list.map((m) => {
        if (!m) return '';

        if (m.mode === 'auto' && m.action?.type === 'stk') {
            const label = m.action.label || 'Pay with M-Pesa STK';
            const button = invoiceUrl
                ? `<div style="text-align:center;margin:14px 0 4px 0;">
                       <a href="${invoiceUrl}" style="display:inline-block;background:#0369a1;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">
                           📱 ${label}
                       </a>
                       <p style="margin:8px 0 0 0;font-size:12px;color:#0c4a6e;">You'll be asked for your M-Pesa phone number on the next page.</p>
                   </div>`
                : '';
            return `
                <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin:10px 0;border-left:4px solid #0369a1;">
                    <p style="margin:0 0 6px 0;font-weight:700;color:#0c4a6e;">⚡ ${m.title || 'M-Pesa STK Push'}</p>
                    ${m.description ? `<p style="margin:4px 0;font-size:13px;color:#0c4a6e;">${m.description}</p>` : ''}
                    ${button}
                </div>`;
        }

        if (m.mode === 'auto' && m.action?.type === 'stripe') {
            const label = m.action.label || 'Pay with Card';
            const button = invoiceUrl
                ? `<div style="text-align:center;margin:14px 0 4px 0;">
                       <a href="${invoiceUrl}" style="display:inline-block;background:#635bff;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">
                           💳 ${label}
                       </a>
                   </div>`
                : '';
            return `
                <div style="background:#f5f3ff;padding:16px;border-radius:8px;margin:10px 0;border-left:4px solid #635bff;">
                    <p style="margin:0 0 6px 0;font-weight:700;color:#4c1d95;">${m.title || 'Card Payment'}</p>
                    ${m.description ? `<p style="margin:4px 0;font-size:13px;color:#4c1d95;">${m.description}</p>` : ''}
                    ${button}
                </div>`;
        }

        if (m.mode === 'auto' && invoiceUrl) {
            return `
                <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin:10px 0;border-left:4px solid #0369a1;">
                    <p style="margin:0 0 6px 0;font-weight:700;color:#0c4a6e;">${m.title || 'Online Payment'}</p>
                    ${m.description ? `<p style="margin:4px 0;font-size:13px;color:#0c4a6e;">${m.description}</p>` : ''}
                    <div style="text-align:center;margin:14px 0 4px 0;">
                        <a href="${invoiceUrl}" style="display:inline-block;background:#0369a1;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">
                            ${m.action?.label || 'Pay Now'}
                        </a>
                    </div>
                </div>`;
        }

        if (m.mode === 'manual') {
            const steps = Array.isArray(m.steps) ? m.steps : [];
            return `
                <div style="background:#f0f9ff;padding:14px;border-radius:8px;margin:10px 0;border-left:4px solid #0369a1;">
                    <p style="margin:0 0 6px 0;font-weight:700;color:#0c4a6e;">${m.title || 'Manual Payment'}</p>
                    ${m.description ? `<p style="margin:4px 0;font-size:13px;color:#0c4a6e;">${m.description}</p>` : ''}
                    ${steps.length ? `<ol style="margin:6px 0 0 0;padding-left:20px;font-size:13px;color:#0c4a6e;">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>` : ''}
                </div>`;
        }

        return '';
    }).join('');
};

/* ============ FARMER — REGISTRATION ============ */

const farmerRegistrationPending = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const email = settings?.system?.supportEmail || 'support@farmvexa.com';

    const instructionsHTML = renderInstructions(data.paymentInstructions, data.invoiceUrl);

    return {
        subject: '⏳ Your FarmVexa registration is under review',
        html: baseTemplate(`
            <h2>Registration Received!</h2>
            <p>Hello <strong>${user.name || data.name}</strong>,</p>
            <p>Your FarmVexa registration has been received. Please complete payment to activate your account.</p>

            <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">📋 Registration Details</h3>
                <div class="data-row"><span class="data-label">Plan:</span><span class="data-value">${data.planName || 'N/A'}</span></div>
                <div class="data-row"><span class="data-label">Amount:</span><span class="data-value">KES ${data.amount || 0} (${data.interval || 'one-time'})</span></div>
                ${data.invoiceNumber ? `<div class="data-row"><span class="data-label">Invoice:</span><span class="data-value mono">${data.invoiceNumber}</span></div>` : ''}
                ${data.dueDate ? `<div class="data-row"><span class="data-label">Pay Before:</span><span class="data-value">${new Date(data.dueDate).toLocaleString('en-KE')}</span></div>` : ''}
            </div>

            <div style="background:#eff6ff;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">👤 Your Details</h3>
                <div class="data-row"><span class="data-label">Name:</span><span class="data-value">${user.name || data.name}</span></div>
                <div class="data-row"><span class="data-label">Email:</span><span class="data-value">${user.email || data.email}</span></div>
                <div class="data-row"><span class="data-label">Phone:</span><span class="data-value">${user.phone || data.phone}</span></div>
                ${data.county ? `<div class="data-row"><span class="data-label">Location:</span><span class="data-value">${data.county}, ${data.subCounty || ''}</span></div>` : ''}
            </div>

            ${instructionsHTML ? `
            <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">💳 How to Pay</h3>
                ${instructionsHTML}
            </div>` : ''}

            <div style="background:#fefce8;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">⏳ What Happens Next</h3>
                <ol style="margin:0;padding-left:20px;">
                    <li>Complete payment using the instructions above</li>
                    <li>We verify your payment</li>
                    <li>Admin approves your account</li>
                    <li>You receive a welcome email with login instructions</li>
                </ol>
                <p style="margin:8px 0 0;font-size:12px;color:#d97706;">⚠️ If payment is not received within 3 hours, registration is auto-rejected.</p>
            </div>

            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone} | 📧 ${email}</p>
        `, settings),
    };
};

const farmerAutoRejected = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const email = settings?.system?.supportEmail || 'support@farmvexa.com';

    return {
        subject: '⏰ FarmVexa registration expired — no payment received',
        html: baseTemplate(`
            <h2>Registration Expired</h2>
            <p>Hello <strong>${user.name || data.name}</strong>,</p>

            <div class="alert-high">
                <strong>Your FarmVexa registration has been auto-rejected.</strong>
            </div>

            <div style="background:#fdf0ef;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">⏰ Why</h3>
                <p style="margin:0;">We did not receive your payment within 3 hours of registration.</p>
            </div>

            <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">📋 Your Registration</h3>
                <div class="data-row"><span class="data-label">Plan:</span><span class="data-value">${data.planName || 'N/A'}</span></div>
                <div class="data-row"><span class="data-label">Amount:</span><span class="data-value">KES ${data.amount || 0}</span></div>
                ${data.invoiceNumber ? `<div class="data-row"><span class="data-label">Invoice:</span><span class="data-value mono">${data.invoiceNumber}</span></div>` : ''}
            </div>

            <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">💡 What Now</h3>
                <ol style="margin:0;padding-left:20px;">
                    <li>Register again at farmvexa.pxxl.click/register</li>
                    <li>Complete payment at checkout</li>
                    <li>Your new registration will be processed within 24 hours</li>
                </ol>
            </div>

            <a href="${process.env.CLIENT_URL}/register" class="button">Register Again</a>
            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone} | 📧 ${email}</p>
        `, settings),
    };
};

const farmerApproved = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return {
        subject: '✅ Welcome to FarmVexa! Your account is approved',
        html: baseTemplate(`
            <h2>🎉 You're Approved, ${user.name}!</h2>
            <div class="alert-success"><strong>Your account is now active.</strong></div>
            ${data.planName ? `<div class="data-row"><span class="data-label">Plan:</span><span class="data-value">${data.planName}</span></div>` : ''}
            ${data.subscriptionExpiry ? `<div class="data-row"><span class="data-label">Valid Until:</span><span class="data-value">${new Date(data.subscriptionExpiry).toLocaleDateString('en-KE')}</span></div>` : '<div class="data-row"><span class="data-label">Plan Type:</span><span class="data-value">Lifetime</span></div>'}
            <p>You can now:</p>
            <ul>
                <li>📡 Connect IoT sensors</li>
                <li>📸 Scan crops for diseases</li>
                <li>🌾 Run field scans with GPS</li>
                <li>🤖 Chat with AI</li>
                <li>📊 View dashboards</li>
            </ul>
            <a href="${process.env.CLIENT_URL}/login" class="button">Login to Dashboard</a>
            <p style="margin-top:15px;font-size:13px;color:#777">Need help? 📞 ${phone}</p>
        `, settings),
    };
};

const farmerRejected = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const email = settings?.system?.supportEmail || 'support@farmvexa.com';
    return {
        subject: 'Update regarding your FarmVexa registration',
        html: baseTemplate(`
            <h2>Registration Update</h2>
            <div class="alert-high"><strong>Hello ${user.name},</strong><br>Your registration was not approved.</div>
            <div class="data-row"><span class="data-label">Reason:</span><span class="data-value">${data.reason || user.rejectionReason || 'No reason'}</span></div>
            <p style="margin-top:15px;font-size:13px;color:#777">📞 ${phone}<br>📧 ${email}</p>
        `, settings),
    };
};

/* ============ FARMER — INVOICE + PAYMENT ============ */

const farmerInvoice = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const email = settings?.system?.supportEmail || 'support@farmvexa.com';

    const instructionsHTML = renderInstructions(data.paymentInstructions, data.invoiceUrl);

    return {
        subject: `📄 Invoice ${data.invoiceNumber} — FarmVexa`,
        html: baseTemplate(`
            <h2>Invoice ${data.invoiceNumber}</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>Please pay your invoice to activate your FarmVexa account.</p>

            <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;">
                <div class="data-row"><span class="data-label">Plan:</span><span class="data-value">${data.planName || 'N/A'}</span></div>
                <div class="data-row"><span class="data-label">Amount Due:</span><span class="data-value" style="font-weight:700;font-size:18px;color:#15803d;">KES ${data.amount || 0}</span></div>
                <div class="data-row"><span class="data-label">Invoice #:</span><span class="data-value mono">${data.invoiceNumber}</span></div>
                <div class="data-row"><span class="data-label">Due:</span><span class="data-value">${data.dueDate ? new Date(data.dueDate).toLocaleString('en-KE') : 'N/A'}</span></div>
            </div>

            ${instructionsHTML ? `
            <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">💳 Payment Options</h3>
                ${instructionsHTML}
            </div>` : ''}

            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone} | 📧 ${email}</p>
        `, settings),
    };
};

const farmerPaymentReceived = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return {
        subject: `✅ Payment received — ${data.invoiceNumber}`,
        html: baseTemplate(`
            <h2>✅ Payment Received</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <div class="alert-success"><strong>We've received your payment. Thank you!</strong></div>

            <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;">
                <div class="data-row"><span class="data-label">Invoice:</span><span class="data-value mono">${data.invoiceNumber}</span></div>
                <div class="data-row"><span class="data-label">Amount:</span><span class="data-value">KES ${data.amount || 0}</span></div>
                <div class="data-row"><span class="data-label">Method:</span><span class="data-value">${methodLabels[data.paymentMethod] || data.paymentMethod || 'M-Pesa'}</span></div>
                <div class="data-row"><span class="data-label">Reference:</span><span class="data-value mono">${data.paymentReference || 'N/A'}</span></div>
                <div class="data-row"><span class="data-label">Date:</span><span class="data-value">${data.paidAt ? new Date(data.paidAt).toLocaleString('en-KE') : new Date().toLocaleString('en-KE')}</span></div>
            </div>

            <div class="alert-info">
                <strong>Next step:</strong> Your account is under review. We'll notify you once approved.
            </div>

            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone}</p>
        `, settings),
    };
};

const farmerInvoiceReminder = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const instructionsHTML = renderInstructions(data.paymentInstructions, data.invoiceUrl);
    return {
        subject: `⏰ Invoice ${data.invoiceNumber} due soon`,
        html: baseTemplate(`
            <h2>⏰ Payment Reminder</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <div class="alert-medium">
                <strong>Invoice ${data.invoiceNumber} is due soon.</strong>
            </div>
            <div class="data-row"><span class="data-label">Amount Due:</span><span class="data-value">KES ${data.amount || 0}</span></div>
            <div class="data-row"><span class="data-label">Due:</span><span class="data-value">${data.dueDate ? new Date(data.dueDate).toLocaleString('en-KE') : 'N/A'}</span></div>
            <p>Please complete payment to avoid cancellation.</p>
            ${instructionsHTML}
            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone}</p>
        `, settings),
    };
};

/* ============ FARMER — RENEWAL ============ */

const farmerRenewalReceived = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const email = settings?.system?.supportEmail || 'support@farmvexa.com';

    const instructionsHTML = renderInstructions(data.paymentInstructions, data.invoiceUrl);

    return {
        subject: '🔄 Renewal Received — FarmVexa',
        html: baseTemplate(`
            <h2>Renewal Request Received!</h2>
            <p>Hello <strong>${user.name || data.name}</strong>,</p>
            <p>Your subscription renewal request has been received.</p>

            <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">📋 Renewal Details</h3>
                <div class="data-row"><span class="data-label">Plan:</span><span class="data-value">${data.planName || 'N/A'}</span></div>
                <div class="data-row"><span class="data-label">Amount:</span><span class="data-value">KES ${data.amount || 0}</span></div>
                ${data.invoiceNumber ? `<div class="data-row"><span class="data-label">Invoice:</span><span class="data-value mono">${data.invoiceNumber}</span></div>` : ''}
                ${data.dueDate ? `<div class="data-row"><span class="data-label">Pay Before:</span><span class="data-value">${new Date(data.dueDate).toLocaleString('en-KE')}</span></div>` : ''}
                ${data.previousExpiry ? `<div class="data-row"><span class="data-label">Previous Expiry:</span><span class="data-value">${new Date(data.previousExpiry).toLocaleDateString('en-KE')}</span></div>` : ''}
            </div>

            ${instructionsHTML ? `
            <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">💳 How to Pay</h3>
                ${instructionsHTML}
            </div>` : ''}

            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone} | 📧 ${email}</p>
        `, settings),
    };
};

const farmerRenewalApproved = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return {
        subject: '✅ Renewal Approved — Subscription Active',
        html: baseTemplate(`
            <h2>🎉 Renewal Approved!</h2>
            <p>Hello <strong>${user.name}</strong>,</p>
            <div class="alert-success"><strong>Your subscription has been renewed successfully.</strong></div>

            <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;">
                <div class="data-row"><span class="data-label">Plan:</span><span class="data-value">${data.planName || 'N/A'}</span></div>
                <div class="data-row"><span class="data-label">New Expiry:</span><span class="data-value">${data.newExpiry ? new Date(data.newExpiry).toLocaleDateString('en-KE') : 'N/A'}</span></div>
                ${data.renewalCount ? `<div class="data-row"><span class="data-label">Renewal #:</span><span class="data-value">${data.renewalCount}</span></div>` : ''}
            </div>

            <a href="${process.env.CLIENT_URL}/dashboard" class="button">Go to Dashboard</a>
            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone}</p>
        `, settings),
    };
};

const farmerRenewalRejected = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const email = settings?.system?.supportEmail || 'support@farmvexa.com';
    return {
        subject: 'Update regarding your FarmVexa renewal',
        html: baseTemplate(`
            <h2>Renewal Update</h2>
            <div class="alert-high">
                <strong>Hello ${user.name},</strong><br>Your renewal request was not approved.
            </div>
            <div class="data-row"><span class="data-label">Reason:</span><span class="data-value">${data.reason || 'No reason provided'}</span></div>
            <p style="margin-top:15px;">To try again, go to <a href="${process.env.CLIENT_URL}/renewal">Renewal page</a>.</p>
            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone} | 📧 ${email}</p>
        `, settings),
    };
};

/* ============ FARMER — UPGRADE ============ */

const farmerUpgradeReceived = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const instructionsHTML = renderInstructions(data.paymentInstructions, data.invoiceUrl);
    return {
        subject: `⬆️ Upgrade Request Received — ${data.newPlan}`,
        html: baseTemplate(`
            <h2>Upgrade Request Received!</h2>
            <p>Hello <strong>${user.name}</strong>,</p>
            <p>Your upgrade request has been received.</p>

            <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;">
                <div class="data-row"><span class="data-label">Current Plan:</span><span class="data-value">${data.oldPlan || 'N/A'}</span></div>
                <div class="data-row"><span class="data-label">New Plan:</span><span class="data-value"><strong>${data.newPlan}</strong></span></div>
                <div class="data-row"><span class="data-label">Amount:</span><span class="data-value">KES ${data.amount || 0}</span></div>
                ${data.invoiceNumber ? `<div class="data-row"><span class="data-label">Invoice:</span><span class="data-value mono">${data.invoiceNumber}</span></div>` : ''}
                ${data.dueDate ? `<div class="data-row"><span class="data-label">Pay Before:</span><span class="data-value">${new Date(data.dueDate).toLocaleString('en-KE')}</span></div>` : ''}
            </div>

            ${instructionsHTML ? `
            <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">💳 How to Pay</h3>
                ${instructionsHTML}
            </div>` : ''}

            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone}</p>
        `, settings),
    };
};

const farmerUpgradeApproved = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return {
        subject: `🎉 Upgrade Approved — You're now on ${data.newPlan}!`,
        html: baseTemplate(`
            <h2>🎉 Upgrade Approved!</h2>
            <p>Hello <strong>${user.name}</strong>,</p>
            <div class="alert-success"><strong>Your plan has been upgraded to ${data.newPlan}.</strong></div>
            <div class="data-row"><span class="data-label">Plan:</span><span class="data-value"><strong>${data.newPlan}</strong></span></div>
            <div class="data-row"><span class="data-label">Status:</span><span class="data-value">Active</span></div>
            <a href="${process.env.CLIENT_URL}/dashboard" class="button">Go to Dashboard</a>
            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone}</p>
        `, settings),
    };
};

const farmerUpgradeRejected = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const email = settings?.system?.supportEmail || 'support@farmvexa.com';
    return {
        subject: 'Update regarding your FarmVexa upgrade request',
        html: baseTemplate(`
            <h2>Upgrade Update</h2>
            <div class="alert-high">
                <strong>Hello ${user.name},</strong><br>Your upgrade request was not approved.
            </div>
            <div class="data-row"><span class="data-label">Reason:</span><span class="data-value">${data.reason || 'No reason provided'}</span></div>
            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone} | 📧 ${email}</p>
        `, settings),
    };
};

/* ============ ADMIN — PAYMENT + REGISTRATION ============ */

const adminNewFarmer = async (user, data, settings) => ({
    subject: `👨‍🌾 New Farmer: ${data.farmer?.name || data.name || 'Unknown'}`,
    html: baseTemplate(`
        <h2>👨‍🌾 New Farmer Pending</h2>
        <div class="data-row"><span class="data-label">Name:</span><span class="data-value">${data.farmer?.name || data.name || 'N/A'}</span></div>
        <div class="data-row"><span class="data-label">Email:</span><span class="data-value">${data.farmer?.email || data.email || 'N/A'}</span></div>
        <div class="data-row"><span class="data-label">Phone:</span><span class="data-value">${data.farmer?.phone || data.phone || 'N/A'}</span></div>
        ${data.planName ? `<div class="data-row"><span class="data-label">Plan:</span><span class="data-value">${data.planName}</span></div>` : ''}
        ${data.amount ? `<div class="data-row"><span class="data-label">Amount:</span><span class="data-value">KES ${data.amount}</span></div>` : ''}
        ${data.invoiceNumber ? `<div class="data-row"><span class="data-label">Invoice:</span><span class="data-value mono">${data.invoiceNumber}</span></div>` : ''}
        <a href="${process.env.ADMIN_URL}/approvals" class="button">Review & Approve</a>
    `, settings),
});

const adminPaymentReceived = async (user, data, settings) => ({
    subject: `💳 Payment Received — ${data.farmer?.name || data.name} (${data.planName || 'N/A'})`,
    html: baseTemplate(`
        <h2>💳 New Payment</h2>
        <div class="alert-success"><strong>Payment received. Ready for review.</strong></div>
        <div class="data-row"><span class="data-label">Farmer:</span><span class="data-value">${data.farmer?.name || data.name || 'N/A'}</span></div>
        <div class="data-row"><span class="data-label">Email:</span><span class="data-value">${data.farmer?.email || data.email || 'N/A'}</span></div>
        <div class="data-row"><span class="data-label">Plan:</span><span class="data-value">${data.planName || 'N/A'}</span></div>
        <div class="data-row"><span class="data-label">Amount:</span><span class="data-value">KES ${data.amount || 0}</span></div>
        ${data.invoiceNumber ? `<div class="data-row"><span class="data-label">Invoice:</span><span class="data-value mono">${data.invoiceNumber}</span></div>` : ''}
        ${data.paymentMethod ? `<div class="data-row"><span class="data-label">Method:</span><span class="data-value">${methodLabels[data.paymentMethod] || data.paymentMethod}</span></div>` : ''}
        ${data.reference ? `<div class="data-row"><span class="data-label">Reference:</span><span class="data-value mono">${data.reference}</span></div>` : ''}
        <a href="${process.env.ADMIN_URL}/approvals" class="button">Review</a>
    `, settings),
});

const adminRenewalRequest = async (user, data, settings) => ({
    subject: `🔄 Renewal Request — ${data.farmer?.name || data.name} (${data.planName || 'Unknown'})`,
    html: baseTemplate(`
        <h2>🔄 New Renewal Request</h2>
        <div class="data-row"><span class="data-label">Farmer:</span><span class="data-value">${data.farmer?.name || data.name || 'N/A'}</span></div>
        <div class="data-row"><span class="data-label">Plan:</span><span class="data-value">${data.planName || 'N/A'}</span></div>
        <div class="data-row"><span class="data-label">Amount:</span><span class="data-value">KES ${data.amount || 0}</span></div>
        ${data.invoiceNumber ? `<div class="data-row"><span class="data-label">Invoice:</span><span class="data-value mono">${data.invoiceNumber}</span></div>` : ''}
        <a href="${process.env.ADMIN_URL}/approvals" class="button">Review Renewal</a>
    `, settings),
});

const adminUpgradeRequest = async (user, data, settings) => ({
    subject: `⬆️ Upgrade Request — ${data.farmer?.name || data.name} (${data.oldPlan} → ${data.newPlan})`,
    html: baseTemplate(`
        <h2>⬆️ New Upgrade Request</h2>
        <div class="data-row"><span class="data-label">Farmer:</span><span class="data-value">${data.farmer?.name || data.name || 'N/A'}</span></div>
        <div class="data-row"><span class="data-label">Current Plan:</span><span class="data-value">${data.oldPlan || 'N/A'}</span></div>
        <div class="data-row"><span class="data-label">New Plan:</span><span class="data-value"><strong>${data.newPlan || 'N/A'}</strong></span></div>
        <div class="data-row"><span class="data-label">Amount:</span><span class="data-value">KES ${data.amount || 0}</span></div>
        ${data.invoiceNumber ? `<div class="data-row"><span class="data-label">Invoice:</span><span class="data-value mono">${data.invoiceNumber}</span></div>` : ''}
        <a href="${process.env.ADMIN_URL}/approvals" class="button">Review Upgrade</a>
    `, settings),
});

/* ============ FARMER — ACCOUNT ============ */

const farmerWelcome = async (user, data, settings) => ({
    subject: `Welcome to FarmVexa, ${user.name}! 🌾`,
    html: baseTemplate(`<h2>Welcome, ${user.name}! 👋</h2><div class="alert-success"><strong>Your account is ready!</strong></div><a href="${process.env.CLIENT_URL}/login" class="button">Go to Dashboard</a>`, settings),
});

const farmerEmailVerify = async (user, data, settings) => ({
    subject: 'Verify Your FarmVexa Email',
    html: baseTemplate(`<h2>Verify Your Email</h2><a href="${process.env.CLIENT_URL}/verify-email/${data.token || ''}" class="button">Verify Email</a>`, settings),
});

const farmerPasswordReset = async (user, data, settings) => ({
    subject: 'FarmVexa - Password Reset',
    html: baseTemplate(`<h2>Password Reset</h2><a href="${data.resetUrl || ''}" class="button">Reset Password</a><p style="font-size:13px;color:#777">Link expires in 30 minutes.</p>`, settings),
});

/* ============ FARMER — ALERTS ============ */

const farmerAlertHigh = async (user, data, settings) => ({
    subject: `🔴 HIGH RISK ALERT - ${data.farmName || 'Your Farm'}`,
    html: baseTemplate(`<h2>🔴 High Risk Alert</h2><div class="alert-high"><strong>${data.message}</strong></div><div class="data-row"><span class="data-label">Farm:</span><span class="data-value">${data.farmName || 'N/A'}</span></div><div class="data-row"><span class="data-label">Severity:</span><span class="data-value">HIGH</span></div>${data.recommendation?`<div class="data-row"><span class="data-label">Action:</span><span class="data-value">${data.recommendation}</span></div>`:''}<a href="${process.env.CLIENT_URL}/alerts" class="button">View Alert</a>`, settings),
});

const farmerAlertMedium = async (user, data, settings) => ({
    subject: `🟡 MEDIUM ALERT - ${data.farmName || 'Your Farm'}`,
    html: baseTemplate(`<h2>🟡 Medium Alert</h2><div class="alert-medium"><strong>${data.message}</strong></div><a href="${process.env.CLIENT_URL}/alerts" class="button">View Details</a>`, settings),
});

const farmerDiseaseDetected = async (user, data, settings) => ({
    subject: `🦠 Disease Detected: ${data.disease} - ${data.farmName || 'Your Farm'}`,
    html: baseTemplate(`<h2>🦠 Crop Disease Detected</h2><div class="alert-high"><strong>${data.disease}</strong> (${data.confidence}%)</div><div class="data-row"><span class="data-label">Farm:</span><span class="data-value">${data.farmName || 'N/A'}</span></div><div class="data-row"><span class="data-label">Crop:</span><span class="data-value">${data.cropType || 'N/A'}</span></div>${data.recommendation?`<div class="data-row"><span class="data-label">Action:</span><span class="data-value">${data.recommendation}</span></div>`:''}<a href="${process.env.CLIENT_URL}/crops" class="button">View Analysis</a>`, settings),
});

const farmerDeviceOffline = async (user, data, settings) => ({
    subject: `📡 Device Offline - ${data.deviceId || 'Unknown'}`,
    html: baseTemplate(`<h2>📡 Device Offline</h2><div class="alert-medium"><strong>Device ${data.deviceId || 'Unknown'} is offline.</strong></div><div class="data-row"><span class="data-label">Last Seen:</span><span class="data-value">${data.lastSeen || 'Unknown'}</span></div><a href="${process.env.CLIENT_URL}/devices" class="button">Check Device</a>`, settings),
});

/* ============ FARMER — DAILY / WEEKLY REPORTS ============ */

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

            <a href="${process.env.CLIENT_URL}/dashboard" class="button">View Full Dashboard</a>
            <p style="margin-top:15px;font-size:13px;color:#777">Need help? 📞 ${phone}</p>
        `, settings),
    };
};

const farmerWeeklyReport = async (user, data, settings) => ({
    subject: `📈 Weekly Farm Report - ${data.farmName || 'Your Farm'}`,
    html: baseTemplate(`<h2>📈 Weekly Report</h2><div class="data-row"><span class="data-label">🟢 Health:</span><span class="data-value">${data.avgHealthScore || 'N/A'}%</span></div><div class="data-row"><span class="data-label">⚠️ Alerts:</span><span class="data-value">${data.totalAlerts || 0}</span></div><div class="data-row"><span class="data-label">📸 Scans:</span><span class="data-value">${data.cropScans || 0}</span></div><a href="${process.env.CLIENT_URL}/dashboard" class="button">View Report</a>`, settings),
});

const farmerNewDeviceLogin = async (user, data, settings) => ({
    subject: '🔐 New Device Login - FarmVexa',
    html: baseTemplate(`<h2>🔐 New Device Login</h2><p>Your account was accessed from a new device.</p><div class="data-row"><span class="data-label">Browser:</span><span class="data-value">${data.browser || 'Unknown'}</span></div><div class="data-row"><span class="data-label">Time:</span><span class="data-value">${new Date().toLocaleString('en-KE')}</span></div>`, settings),
});

/* ============ FARMER — OTHER ============ */

const farmerVaccinationDue = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return {
        subject: `💉 Vaccination Due: ${data.animalName || 'Animal'}`,
        html: baseTemplate(`<h2>💉 Vaccination Due</h2><div class="alert-medium"><strong>${data.vaccineType || 'Vaccine'} due for ${data.animalName || 'animal'}</strong></div><div class="data-row"><span class="data-label">Days Left:</span><span class="data-value">${data.daysLeft === 0 ? 'TODAY!' : data.daysLeft + ' days'}</span></div><a href="${process.env.CLIENT_URL}/health" class="button">View Health Records</a><p style="margin-top:15px;font-size:13px;color:#777">📞 ${phone}</p>`, settings),
    };
};

const farmerLivestockAlert = async (user, data, settings) => ({
    subject: `🐄 Livestock Alert: ${data.animalName || 'Animal'}`,
    html: baseTemplate(`<h2>🐄 Livestock Alert</h2><div class="alert-high"><strong>${data.message}</strong></div><a href="${process.env.CLIENT_URL}/health" class="button">View Details</a>`, settings),
});

const farmerLowStock = async (user, data, settings) => ({
    subject: `📦 Low Stock Alert: ${data.itemName}`,
    html: baseTemplate(`<h2>📦 Low Stock Alert</h2><div class="alert-medium"><strong>${data.itemName} is running low.</strong></div><div class="data-row"><span class="data-label">Remaining:</span><span class="data-value">${data.quantity} ${data.unit||''}</span></div><a href="${process.env.CLIENT_URL}/operations" class="button">Manage Inventory</a>`, settings),
});

const farmerMaintenanceDue = async (user, data, settings) => ({
    subject: `🔧 Maintenance Due: ${data.equipmentName}`,
    html: baseTemplate(`<h2>🔧 Maintenance Due</h2><div class="alert-info"><strong>${data.equipmentName} needs maintenance.</strong></div><a href="${process.env.CLIENT_URL}/operations" class="button">View Equipment</a>`, settings),
});

const farmerWeatherAlert = async (user, data, settings) => ({
    subject: `⚠️ Weather Alert: ${data.type || 'Weather'} - ${data.farmName||'Your Farm'}`,
    html: baseTemplate(`<h2>⚠️ Weather Alert</h2><div class="alert-medium"><strong>${data.message}</strong></div>${data.recommendation?`<div class="data-row"><span class="data-label">Action:</span><span class="data-value">${data.recommendation}</span></div>`:''}<a href="${process.env.CLIENT_URL}/weather" class="button">View Weather</a>`, settings),
});

const farmerTaskOverdue = async (user, data, settings) => ({
    subject: `⏰ Task Overdue: ${data.title}`,
    html: baseTemplate(`<h2>⏰ Task Overdue</h2><div class="alert-high"><strong>${data.title}</strong> is past due.</div><a href="${process.env.CLIENT_URL}/operations" class="button">View Tasks</a>`, settings),
});

const farmerReminderUpcoming = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return {
        subject: `⏰ Upcoming Reminders — ${data.farmName || 'Your Farm'}`,
        html: baseTemplate(`
            <h2>⏰ Upcoming Reminders</h2>
            ${(data.reminders || []).map((r) => `
                <div style="background:#fef9e7;padding:12px;border-radius:8px;margin:8px 0;border-left:4px solid #f59e0b;">
                    <strong>${r.title}</strong>
                    <p style="margin:4px 0;font-size:13px;">${r.description || ''}</p>
                    <span style="font-size:12px;color:#f59e0b;">Due: ${new Date(r.dueDate).toLocaleDateString('en-KE')}</span>
                </div>
            `).join('')}
            <a href="${process.env.CLIENT_URL}/operations" class="button">View Details</a>
            <p style="margin-top:15px;font-size:13px;color:#777">📞 ${phone}</p>
        `, settings),
    };
};

const farmerReminderFinal = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return {
        subject: `🔴 Action Required TODAY — ${data.farmName || 'Your Farm'}`,
        html: baseTemplate(`
            <h2>🔴 Action Required Today</h2>
            ${(data.reminders || []).map((r) => `
                <div style="background:#fdf0ef;padding:12px;border-radius:8px;margin:8px 0;border-left:4px solid #e74c3c;">
                    <strong>${r.title}</strong>
                    <p style="margin:4px 0;font-size:13px;">${r.description || ''}</p>
                    <span style="font-size:12px;color:#e74c3c;">⚠️ Due Today</span>
                </div>
            `).join('')}
            <a href="${process.env.CLIENT_URL}/operations" class="button">View Details</a>
            <p style="margin-top:15px;font-size:13px;color:#777">📞 ${phone}</p>
        `, settings),
    };
};

const teamMemberAdded = async (user, data, settings) => ({
    subject: `Welcome to FarmVexa, ${user.name}!`,
    html: baseTemplate(`<h2>Welcome to the Team! 👋</h2><div class="alert-success"><strong>You've been added as ${data.role||'team member'}.</strong></div><div class="data-row"><span class="data-label">Email:</span><span class="data-value">${data.email||user.email}</span></div><div class="data-row"><span class="data-label">Password:</span><span class="data-value">${data.password||'N/A'}</span></div><a href="${process.env.CLIENT_URL}/login" class="button">Login to FarmVexa</a>`, settings),
});

const farmerFieldScanResults = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const email = settings?.system?.supportEmail || 'support@farmvexa.com';

    const diseaseList = (data.diseases || []).map((d) => `
        <div style="background:#fdf0ef;padding:12px;border-radius:8px;margin:8px 0;border-left:4px solid #e74c3c;">
            <strong>🦠 ${d.name || 'Unknown Disease'}</strong>
            <p style="margin:4px 0;font-size:13px;">Severity: <strong>${(d.severity || 'N/A').toUpperCase()}</strong></p>
            ${d.location ? `<p style="margin:4px 0;font-size:13px;">📍 Lat: ${d.location.lat}, Lng: ${d.location.lng}</p>` : ''}
        </div>
    `).join('') || '<p>✅ No diseases detected.</p>';

    const recommendations = (data.recommendations || []).map((r) => `<li style="margin:4px 0;">${r}</li>`).join('') || '<li>No specific recommendations.</li>';

    return {
        subject: `🌾 Field Scan Complete — ${data.fieldName || 'Your Field'}`,
        html: baseTemplate(`
            <h2>🌾 Field Scan Complete</h2>
            <p>Hello ${user.name}, your field scan for <strong>${data.fieldName || 'your field'}</strong> is ready.</p>
            <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;">
                <div class="data-row"><span class="data-label">Photos Captured:</span><span class="data-value">${data.totalPhotos || 0}</span></div>
                <div class="data-row"><span class="data-label">Photos Analyzed:</span><span class="data-value">${data.analyzedPhotos || 0}</span></div>
                <div class="data-row"><span class="data-label">Diseases Detected:</span><span class="data-value">${data.diseaseCount || 0}</span></div>
                <div class="data-row"><span class="data-label">Healthy:</span><span class="data-value">${data.healthyPercentage || 0}%</span></div>
            </div>
            <div style="background:#eff6ff;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">🦠 Disease Detection</h3>
                ${diseaseList}
            </div>
            <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0;">
                <h3 style="margin:0 0 8px 0;">💡 Recommendations</h3>
                <ul style="margin:0;padding-left:20px;">${recommendations}</ul>
            </div>
            <a href="${process.env.CLIENT_URL}/field-scan/${data.scanId || ''}" class="button">View Full Report</a>
            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone} | 📧 ${email}</p>
        `, settings),
    };
};

const farmerStorageAlert = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    const email = settings?.system?.supportEmail || 'support@farmvexa.com';
    const alertIcons = { storage_temp_critical: '🌡️', storage_humidity_critical: '💧', storage_co2_critical: '🦠', storage_rat_detected: '🐀' };
    const icon = alertIcons[data.alertType] || '⚠️';

    return {
        subject: `${icon} STORAGE ALERT — ${data.farmName || 'Your Farm'}`,
        html: baseTemplate(`
            <h2>${icon} Storage Alert</h2>
            <div class="alert-high"><strong>${data.message}</strong></div>
            ${data.temperature !== undefined ? `<div class="data-row"><span class="data-label">Temperature:</span><span class="data-value">${data.temperature}°C</span></div>` : ''}
            ${data.humidity !== undefined ? `<div class="data-row"><span class="data-label">Humidity:</span><span class="data-value">${data.humidity}%</span></div>` : ''}
            ${data.co2 !== undefined ? `<div class="data-row"><span class="data-label">CO2:</span><span class="data-value">${data.co2}ppm</span></div>` : ''}
            ${data.recommendation ? `<div class="data-row"><span class="data-label">Action:</span><span class="data-value">${data.recommendation}</span></div>` : ''}
            <a href="${process.env.CLIENT_URL}/alerts" class="button">View Alerts</a>
            <p style="margin-top:15px;font-size:13px;color:#777;">Need help? 📞 ${phone} | 📧 ${email}</p>
        `, settings),
    };
};

const marketInquiryEmail = async (user, data, settings) => {
    const phone = settings?.system?.supportPhone || '+254700000000';
    return {
        subject: `🛒 New Market Inquiry — ${data.productName || 'Your Product'}`,
        html: baseTemplate(`
            <h2>🛒 New Market Inquiry</h2>
            <div class="alert-success"><strong>Someone is interested in your product!</strong></div>
            <div class="data-row"><span class="data-label">Product:</span><span class="data-value">${data.productName || 'N/A'}</span></div>
            <div class="data-row"><span class="data-label">Buyer:</span><span class="data-value">${data.buyerName || 'N/A'}</span></div>
            ${data.buyerPhone ? `<div class="data-row"><span class="data-label">Phone:</span><span class="data-value">${data.buyerPhone}</span></div>` : ''}
            ${data.message ? `<p style="font-style:italic;">"${data.message}"</p>` : ''}
            <a href="${process.env.CLIENT_URL}/dashboard" class="button">View In Dashboard</a>
            <p style="margin-top:15px;font-size:13px;color:#777">📞 ${phone}</p>
        `, settings),
    };
};

/* ============ ADMIN — SYSTEM ============ */

const adminSystemCritical = async (user, data, settings) => ({
    subject: '🚨 CRITICAL SYSTEM ALERT',
    html: baseTemplate(`<h2>🚨 Critical Alert</h2><div class="alert-high"><strong>${data.message||'System error'}</strong></div>`, settings),
});

const adminGeminiEightyPercent = async (user, data, settings) => ({
    subject: '⚠️ Gemini API at 80%',
    html: baseTemplate(`<h2>⚠️ Usage Warning</h2><div class="alert-medium"><strong>Daily limit at 80%</strong></div><div class="data-row"><span class="data-label">Today:</span><span class="data-value">${data.requestsToday||0}</span></div>`, settings),
});

const adminGeminiExceeded = async (user, data, settings) => ({
    subject: '🚫 Gemini API Limit Exceeded',
    html: baseTemplate(`<h2>🚫 Limit Exceeded</h2><div class="alert-high"><strong>Daily limit of ${data.dailyLimit||0} reached.</strong></div>`, settings),
});

const adminPythonOffline = async (user, data, settings) => ({
    subject: '🔴 Python AI Engine Offline',
    html: baseTemplate(`<h2>🔴 Python AI Offline</h2><div class="alert-high"><strong>AI Engine not responding.</strong></div>`, settings),
});

const adminDeviceOffline24h = async (user, data, settings) => ({
    subject: `📡 Device Offline 24h+ - ${data.deviceId||'Unknown'}`,
    html: baseTemplate(`<h2>📡 Device Offline 24h+</h2><div class="data-row"><span class="data-label">Device:</span><span class="data-value">${data.deviceId||'Unknown'}</span></div>`, settings),
});

const adminTrainingComplete = async (user, data, settings) => ({
    subject: `✅ Training Complete - ${data.name||'Model'}`,
    html: baseTemplate(`<h2>✅ Training Complete</h2><div class="alert-success"><strong>${data.name||'Model'} ready.</strong></div>`, settings),
});

const adminNewAdmin = async (user, data, settings) => ({
    subject: '🛠️ New Admin Created',
    html: baseTemplate(`<h2>🛠️ New Admin</h2><div class="data-row"><span class="data-label">Name:</span><span class="data-value">${data.name}</span></div>`, settings),
});

const adminWeeklyReport = async (user, data, settings) => ({
    subject: '📊 Weekly System Report',
    html: baseTemplate(`<h2>📊 Weekly Report</h2><div class="data-row"><span class="data-label">👨‍🌾 Farmers:</span><span class="data-value">${data.totalFarmers||0}</span></div><div class="data-row"><span class="data-label">🌾 Farms:</span><span class="data-value">${data.totalFarms||0}</span></div><div class="data-row"><span class="data-label">📸 Scans:</span><span class="data-value">${data.cropScans||0}</span></div>`, settings),
});

/* ============ EXPORTS ============ */

module.exports = {
    farmerRegistrationPending, farmerApproved, farmerRejected, farmerAutoRejected,

    farmerInvoice, farmerPaymentReceived, farmerInvoiceReminder,

    farmerRenewalReceived, farmerRenewalApproved, farmerRenewalRejected,

    farmerUpgradeReceived, farmerUpgradeApproved, farmerUpgradeRejected,

    farmerWelcome, farmerEmailVerify, farmerPasswordReset,

    farmerAlertHigh, farmerAlertMedium, farmerDiseaseDetected, farmerDeviceOffline,

    farmerDailyReport, farmerWeeklyReport, farmerNewDeviceLogin,
    farmerVaccinationDue, farmerLivestockAlert, farmerLowStock,
    farmerMaintenanceDue, farmerWeatherAlert, farmerTaskOverdue,
    farmerReminderUpcoming, farmerReminderFinal,

    farmerFieldScanResults, farmerStorageAlert,

    teamMemberAdded, marketInquiryEmail,

    adminNewFarmer, adminPaymentReceived, adminRenewalRequest, adminUpgradeRequest,
    adminSystemCritical, adminGeminiEightyPercent, adminGeminiExceeded,
    adminPythonOffline, adminDeviceOffline24h, adminTrainingComplete,
    adminNewAdmin, adminWeeklyReport,
};