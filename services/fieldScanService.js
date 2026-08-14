const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const env = require('../config/env');
const logger = require('../utils/logger');

class FieldScanService {
    constructor() {
        this.baseUrl = env.pythonAiUrl;
        this.apiKey = env.internalApiKey;
    }

    async analyzeFieldScan(frames, cropType, fieldId, maxGeminiCalls, preFilterEnabled) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/api/analyze/field-scan`,
                {
                    fieldId,
                    cropType,
                    frames,
                    maxGeminiCalls: maxGeminiCalls || 30,
                    preFilterEnabled: preFilterEnabled ?? true,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                    },
                    timeout: 120000, // 2 minutes for batch processing
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