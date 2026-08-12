const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const env = require('../config/env');
const logger = require('../utils/logger');

class AIService {
    constructor() {
        this.baseUrl = env.pythonAiUrl;
        this.apiKey = env.internalApiKey;
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

    async analyzeCropImage(imagePath, cropType, sensorData = null) {
        try {
            const formData = new FormData();
            formData.append('cropImage', fs.createReadStream(imagePath));
            formData.append('task', sensorData ? 'combined_analysis' : 'image_analysis');
            if (cropType) formData.append('cropType', cropType);
            if (sensorData) formData.append('sensorData', JSON.stringify(sensorData));

            const response = await axios.post(
                `${this.baseUrl}/api/analyze/crop`,
                formData,
                { headers: { ...formData.getHeaders(), 'x-api-key': this.apiKey }, timeout: 60000 }
            );
            return response.data;
        } catch (error) {
            logger.error(`AI crop analysis failed: ${error.message}`);
            throw error;
        }
    }

    async farmerChat(message, systemPrompt = '') {
        try {
            const response = await axios.post(
                `${this.baseUrl}/api/chat`,
                { message, systemPrompt, history: [] },
                { headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey }, timeout: 30000 }
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
            const response = await axios.get(`${this.baseUrl}/api/health`, { timeout: 5000 });
            const data = response.data;
            return {
                status: data?.server?.status === 'running' ? 'connected' : 'offline',
                server: data.server || {},
                ai: data.ai || {},
                mernConnected: data.mern_server?.connected || false,
            };
        } catch (error) {
            return { status: 'offline', server: {}, ai: {}, mernConnected: false };
        }
    }
}

module.exports = new AIService();