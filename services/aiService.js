const axios = require('axios');
const FormData = require('form-data');
const { env } = require('../config/env');
const logger = require('../utils/logger');

class AIService {
    constructor() {
        this.baseUrl = env.pythonAiUrl;
        this.apiKey = env.internalApiKey;
    }

    async warmup() {
        try {
            const startedAt = Date.now();
            await axios.get(`${this.baseUrl}/api/health`, { timeout: 90000 });
            logger.info(`AI warmup ok in ${Date.now() - startedAt}ms`);
        } catch (err) {
            logger.warn(`AI warmup failed: ${err.message}`);
        }
    }

    async analyzeSensors(readings, historicalData = []) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/api/analyze/sensors`,
                { task: 'sensor_analysis', readings, historicalData },
                { headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey }, timeout: 30000 }
            );
            return response.data;
        } catch (error) {
            logger.error(`AI sensor analysis failed: ${error.message}`);
            throw error;
        }
    }

    async analyzeCropImage(imageBuffer, cropType, sensorData = null) {
        if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
            throw new Error('analyzeCropImage: expected a Buffer');
        }

        const formData = new FormData();
        formData.append('cropImage', imageBuffer, {
            filename: `crop_${Date.now()}.jpg`,
            contentType: 'image/jpeg',
        });
        formData.append('task', sensorData ? 'combined_analysis' : 'image_analysis');
        if (cropType) formData.append('cropType', cropType);
        if (sensorData) formData.append('sensorData', JSON.stringify(sensorData));

        const url = `${this.baseUrl}/api/analyze/crop`;
        const headers = { ...formData.getHeaders(), 'x-api-key': this.apiKey };

        for (let attempt = 1; attempt <= 2; attempt += 1) {
            const startedAt = Date.now();
            try {
                logger.info(`AI crop request -> ${url} (attempt=${attempt}, bytes=${imageBuffer.length})`);

                const response = await axios.post(url, formData, {
                    headers,
                    timeout: 120000,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                });

                logger.info(`AI crop response <- ${response.status} in ${Date.now() - startedAt}ms`);
                return response.data;
            } catch (error) {
                const elapsed = Date.now() - startedAt;
                const isTimeout = error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '');
                const status = error.response?.status;
                const body = error.response?.data;

                logger.error(
                    `AI crop analysis failed (attempt=${attempt}, ${elapsed}ms${isTimeout ? ', timeout' : ''}${status ? `, status=${status}` : ''}): ${error.message}`
                );

                if (attempt === 1) {
                    await this.warmup();
                    continue;
                }

                if (body) {
                    const msg = typeof body === 'string' ? body : (body.message || JSON.stringify(body));
                    throw new Error(`AI engine error: ${msg}`);
                }

                throw error;
            }
        }
    }

    async farmerChat(message, systemPrompt = '') {
        try {
            const response = await axios.post(
                `${this.baseUrl}/api/chat`,
                { message, systemPrompt, history: [] },
                { headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey }, timeout: 60000 }
            );
            return response.data;
        } catch (error) {
            logger.error(`AI chat failed: ${error.message}`);
            throw error;
        }
    }

    async getModelDetails() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/models/details`, {
                headers: { 'x-api-key': this.apiKey }, timeout: 10000,
            });
            return response.data;
        } catch (error) {
            logger.error(`Get model details failed: ${error.message}`);
            throw error;
        }
    }

    async trainModel(trainingData) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/api/models/train`,
                trainingData,
                { headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey }, timeout: 30000 }
            );
            return response.data;
        } catch (error) {
            logger.error(`Model training failed: ${error.message}`);
            throw error;
        }
    }

    async checkHealth() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/health`, { timeout: 15000 });
            const data = response.data;
            return {
                status: data?.server?.status === 'running' ? 'connected' : 'offline',
                server: data.server || {},
                ai: data.ai || {},
                mernConnected: data.mern_server?.connected || false,
            };
        } catch (error) {
            logger.error(`AI health check failed: ${error.message}`);
            return { status: 'offline', server: {}, ai: {}, mernConnected: false };
        }
    }
}

module.exports = new AIService();