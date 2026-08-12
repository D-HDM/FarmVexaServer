const axios = require('axios');
const logger = require('../utils/logger');

class HdmAIService {
    constructor() {
        this.url = process.env.HDM_AI_URL;
        this.apiKey = process.env.HDM_AI_API_KEY;
    }

    async chat(message, systemPrompt = '') {
        try {
            const response = await axios.post(
                this.url,
                { message, system_prompt: systemPrompt },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000,
                }
            );

            return {
                success: true,
                data: {
                    reply: response.data.data.reply,
                    tokensUsed: response.data.data.tokens_used,
                    provider: response.data.data.provider,
                },
            };
        } catch (error) {
            logger.error(`HDM AI chat failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new HdmAIService();