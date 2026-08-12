const Settings = require('../../models/admin/Settings');
const PaymentModel = require('../../models/admin/PaymentModel');
const axios = require('axios');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const chat = asyncHandler(async (req, res) => {
    const { message } = req.body;
    if (!message) return errorResponse(res, 'Message is required', 400);

    const settings = await Settings.findOne();
    const chatbot = settings?.system?.chatbot || {};

    if (!chatbot.enabled) {
        return errorResponse(res, 'Chatbot is disabled', 403);
    }

    const paymentModels = await PaymentModel.find({ enabled: true }).sort({ price: 1 });
    const systemPrompt = buildSystemPrompt(settings, chatbot, paymentModels);

    let reply;
    try {
        if (chatbot.aiProvider === 'hdm') {
            reply = await callHdmAI(chatbot, message, systemPrompt);
        } else {
            reply = await callGeminiAI(chatbot, message, systemPrompt);
        }
    } catch (err) {
        logger.error(`Chatbot error: ${err.message}`);
        reply = 'Sorry, I am having trouble. Please try again later.';
    }

    return successResponse(res, { reply });
});

async function callHdmAI(chatbot, message, systemPrompt) {
    if (!chatbot.hdmApiKey || !chatbot.hdmBaseUrl) {
        return 'Chatbot is not fully configured. Please contact support.';
    }

    const response = await axios.post(
        chatbot.hdmBaseUrl,
        { message, system_prompt: systemPrompt },
        {
            headers: {
                'Authorization': `Bearer ${chatbot.hdmApiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        }
    );

    return response.data?.data?.reply || 'Sorry, I am having trouble. Please try again.';
}

async function callGeminiAI(chatbot, message, systemPrompt) {
    if (!chatbot.geminiApiKey) {
        return 'Chatbot is not fully configured. Please contact support.';
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(chatbot.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'models/gemini-3.5-flash' });

    const fullPrompt = `${systemPrompt}\n\nUser: ${message}\nAssistant:`;
    const result = await model.generateContent(fullPrompt);
    const reply = result.response.text();

    return reply || 'Sorry, I am having trouble. Please try again.';
}

function buildSystemPrompt(settings, chatbot, paymentModels) {
    const s = settings?.system || {};

    let prompt = `You are ${chatbot.name || 'FarmVexa AI'}, the official AI assistant for ${s.appName || 'FarmVexa'}.

ABOUT FARMVEXA:
FarmVexa is an AI-Powered Farm Intelligence Platform — "${s.appName || 'FarmVexa'} — See. Sense. Predict. Grow."

FEATURES:
- AI Crop Disease Detection — scan leaves for diseases
- IoT Sensor Monitoring — soil moisture, temperature, humidity
- Livestock & Health Management — animals, vaccinations, treatments
- Production Tracking — milk, eggs, harvest records
- Financial Management — sales, expenses, receipts, pricing
- Stock & Inventory Management — production stock, farm inputs
- Weather Forecasts & Alerts — 7-day forecast, severe weather alerts
- Team Management & Task Assignment
- Reports & Analytics — daily briefings, production reports
- AI Chat Assistant — available in English & Swahili
- Mobile-Friendly Dashboard
- SMS & Email Alerts

CONTACT & SUPPORT:
- Phone: ${s.supportPhone || 'N/A'}
- Email: ${s.supportEmail || 'N/A'}`;

    if (s.showWhatsapp && s.whatsappNumber) {
        prompt += `\n- WhatsApp: ${s.whatsappNumber}`;
    }

    prompt += `\n\nPRICING PLANS:\n`;
    if (paymentModels.length > 0) {
        paymentModels.forEach((p) => {
            prompt += `- ${p.name}: KES ${p.price}/${p.interval} — ${(p.features || []).join(', ')}\n`;
        });
    } else {
        prompt += `- Free plan available. Premium plans coming soon.\n`;
    }

    const downloads = s.downloads?.filter((d) => d.enabled) || [];
    if (downloads.length > 0) {
        prompt += `\nDOWNLOADS:\n`;
        downloads.forEach((d) => {
            prompt += `- ${d.name} v${d.version} (${d.platform})\n`;
        });
    }

    prompt += `\nREGISTRATION: ${s.allowSelfRegistration !== false ? 'Open for self-registration' : 'By invitation only — users need to request access'}.`;

    prompt += `\n\nINSTRUCTIONS:
- Be friendly, helpful, and concise.
- Answer questions about FarmVexa features, pricing, and farming.
- If asked about farming topics, provide helpful advice.
- If asked something outside farming or FarmVexa, politely redirect.
- Always offer to connect the user to support if needed.`;

    return prompt;
}

module.exports = { chat };