const Chat = require('../../models/farm/Chat');
const aiService = require('../../services/aiService');
const aiContextService = require('../../services/aiContextService');
const limitService = require('../../services/limitService');
const TeamMember = require('../../models/farm/TeamMember');
const Farm = require('../../models/farm/Farm');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const DEBUG_CONTEXT =
    String(process.env.DEBUG_CONTEXT || 'false').toLowerCase() === 'true';

function previewPrompt(prompt, maxLen = 3000) {
    if (!prompt) return '<empty>';
    const p = String(prompt);
    return p.length <= maxLen ? p : p.slice(0, maxLen) + `\n...[truncated, total ${p.length} chars]`;
}

const getFarmId = async (user) => {
    if (user.role === 'farmer') {
        const farm = await Farm.findOne({ owner: user.id, status: 'active' });
        return farm?._id;
    }
    const member = await TeamMember.findById(user.id);
    return member?.farm;
};

const getFarmContextForUser = async (user, farmId) => {
    if (user.role === 'farmer') {
        return aiContextService.getAllFarmsContext(user.id);
    }
    return farmId ? aiContextService.getFarmContext(farmId) : null;
};

function describeFarmContext(farmContext) {
    if (!farmContext) return 'NULL';
    if (Array.isArray(farmContext)) {
        return `${farmContext.length} farm(s): ${farmContext.map((f) => f?.farmName || '?').join(', ')}`;
    }
    return `1 farm: ${farmContext?.farmName || '?'}`;
}

/**
 * Build context + systemPrompt once, log if debug enabled, and return.
 * Centralised so startChat and sendMessage share identical behaviour.
 */
async function buildPromptFor(req) {
    const farmId = await getFarmId(req.user);
    const systemContext = await aiContextService.getSystemContext();
    const farmContext = await getFarmContextForUser(req.user, farmId);
    const systemPrompt = aiContextService.buildSystemPrompt(systemContext, farmContext);

    if (DEBUG_CONTEXT) {
        logger.info(
            `[Chat:debug] user=${req.user.id} role=${req.user.role} ` +
            `farmId=${farmId || 'none'} farmContext=${describeFarmContext(farmContext)} ` +
            `systemPromptLen=${systemPrompt.length}`
        );
        logger.info(`[Chat:debug] systemPrompt >>>\n${previewPrompt(systemPrompt)}\n<<<`);
    }

    return { farmId, systemPrompt };
}

async function callAiAndLog(req, farmId, message, systemPrompt) {
    const aiResult = await aiService.farmerChat(message, systemPrompt);
    const keyUsed = aiResult.data?.keyUsed || 'primary';

    await limitService.logUsage(req.user.id, 'chat', aiResult.success, 0, farmId, keyUsed);

    if (DEBUG_CONTEXT) {
        const reply = aiResult.data?.reply || '';
        logger.info(`[Chat:debug] response provider=${keyUsed} replyLen=${reply.length}`);
        logger.info(`[Chat:debug] reply >>> ${reply.slice(0, 500)}${reply.length > 500 ? '...' : ''}`);
    }

    const replyText = aiResult.data?.reply || aiResult.data || 'No response';
    return { replyText, keyUsed, aiResult };
}

const startChat = asyncHandler(async (req, res) => {
    const { message, title } = req.body;
    if (!message) return errorResponse(res, 'Message is required', 400);

    const { farmId, systemPrompt } = await buildPromptFor(req);

    const limitCheck = await limitService.checkLimit(req.user.id, farmId);
    if (!limitCheck.allowed) return errorResponse(res, limitCheck.reason, 429);

    const { replyText } = await callAiAndLog(req, farmId, message, systemPrompt);

    const chat = await Chat.create({
        user: req.user.id,
        title: title || message.substring(0, 50),
        messages: [
            { role: 'user', content: message },
            { role: 'assistant', content: replyText },
        ],
        lastMessageAt: new Date(),
    });

    return successResponse(res, { chat }, 'Chat created', 201);
});

const sendMessage = asyncHandler(async (req, res) => {
    const { message } = req.body;
    const chatId = req.params.id;
    if (!message) return errorResponse(res, 'Message is required', 400);

    const chat = await Chat.findOne({ _id: chatId, user: req.user.id });
    if (!chat) return errorResponse(res, 'Chat not found', 404);

    const { farmId, systemPrompt } = await buildPromptFor(req);

    const limitCheck = await limitService.checkLimit(req.user.id, farmId);
    if (!limitCheck.allowed) return errorResponse(res, limitCheck.reason, 429);

    chat.messages.push({ role: 'user', content: message });
    await chat.save();

    const { replyText } = await callAiAndLog(req, farmId, message, systemPrompt);

    chat.messages.push({ role: 'assistant', content: replyText });
    chat.lastMessageAt = new Date();
    await chat.save();

    return successResponse(res, { chat });
});

const getMyChats = asyncHandler(async (req, res) => {
    const chats = await Chat.find({ user: req.user.id, isActive: true })
        .select('title lastMessageAt createdAt')
        .sort({ lastMessageAt: -1 });
    return successResponse(res, { chats });
});

const getChatById = asyncHandler(async (req, res) => {
    const chat = await Chat.findOne({ _id: req.params.id, user: req.user.id });
    if (!chat) return errorResponse(res, 'Chat not found', 404);
    return successResponse(res, { chat });
});

const updateChatTitle = asyncHandler(async (req, res) => {
    const chat = await Chat.findOneAndUpdate(
        { _id: req.params.id, user: req.user.id },
        { title: req.body.title },
        { new: true }
    );
    if (!chat) return errorResponse(res, 'Chat not found', 404);
    return successResponse(res, { chat }, 'Title updated');
});

const deleteChat = asyncHandler(async (req, res) => {
    const chat = await Chat.findOneAndUpdate(
        { _id: req.params.id, user: req.user.id },
        { isActive: false },
        { new: true }
    );
    if (!chat) return errorResponse(res, 'Chat not found', 404);
    return successResponse(res, null, 'Chat deleted');
});

const clearAllChats = asyncHandler(async (req, res) => {
    await Chat.updateMany({ user: req.user.id }, { isActive: false });
    return successResponse(res, null, 'All chats cleared');
});

module.exports = {
    startChat,
    sendMessage,
    getMyChats,
    getChatById,
    updateChatTitle,
    deleteChat,
    clearAllChats,
};