const axios = require('axios');
const env = require('../config/env');
const logger = require('../utils/logger');

class FieldScanService {
    constructor() {
        this.baseUrl = env.pythonAiUrl;
        this.apiKey = env.internalApiKey;
    }

    async analyzeFieldScan(frames, cropType, fieldId, maxGeminiCalls, preFilterEnabled, preFilterPercentage) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/api/analyze/field-scan`,
                {
                    fieldId,
                    cropType,
                    frames,
                    maxGeminiCalls: maxGeminiCalls || 30,
                    preFilterEnabled: preFilterEnabled ?? true,
                    preFilterPercentage: preFilterPercentage || 60,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                    },
                    timeout: 300000, // 5 minutes for batch processing
                }
            );
            return response.data;
        } catch (error) {
            logger.error(`Field scan AI analysis failed: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new FieldScanService();