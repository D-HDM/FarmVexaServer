const axios = require('axios');
const { env } = require('../config/env');
const logger = require('../utils/logger');

function isValidHttpUrl(value) {
    if (!value || typeof value !== 'string') return false;
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

function sanitizeFrames(frames) {
    if (!Array.isArray(frames)) return { valid: [], rejected: [] };

    const valid = [];
    const rejected = [];

    for (let i = 0; i < frames.length; i += 1) {
        const frame = frames[i];
        if (!frame || typeof frame !== 'object') {
            rejected.push({ index: i, reason: 'not-an-object', value: frame });
            continue;
        }

        const url = frame.imageUrl;

        if (!url) {
            rejected.push({ index: i, reason: 'missing-imageUrl', value: frame });
            continue;
        }

        if (!isValidHttpUrl(url)) {
            rejected.push({ index: i, reason: 'invalid-url', value: url });
            continue;
        }

        valid.push(frame);
    }

    return { valid, rejected };
}

class FieldScanService {
    constructor() {
        this.baseUrl = env.pythonAiUrl;
        this.apiKey = env.internalApiKey;
    }

    async analyzeFieldScan(frames, cropType, fieldId, maxGeminiCalls, preFilterEnabled, preFilterPercentage) {
        logger.info(`[FieldScan] Called: field=${fieldId} crop=${cropType} framesIn=${Array.isArray(frames) ? frames.length : 'N/A'}`);

        if (Array.isArray(frames)) {
            frames.slice(0, 10).forEach((f, i) => {
                const url = f?.imageUrl;
                const short = typeof url === 'string' ? url.slice(0, 120) : String(url);
                logger.info(`[FieldScan] frame[${i}] imageUrl=${short}`);
            });
            if (frames.length > 10) {
                logger.info(`[FieldScan] ...and ${frames.length - 10} more frames`);
            }
        }

        const { valid, rejected } = sanitizeFrames(frames);

        if (rejected.length > 0) {
            logger.warn(`[FieldScan] Rejected ${rejected.length} frames:`);
            rejected.forEach((r) => {
                const short = typeof r.value === 'string' ? r.value.slice(0, 120) : JSON.stringify(r.value).slice(0, 120);
                logger.warn(`[FieldScan]   reject[${r.index}] reason=${r.reason} value=${short}`);
            });
        }

        logger.info(`[FieldScan] Valid frames: ${valid.length} / ${Array.isArray(frames) ? frames.length : 0}`);

        if (valid.length === 0) {
            logger.warn('[FieldScan] No valid frame URLs — aborting before calling Python');
            return {
                success: false,
                message: 'No valid frame URLs to analyze. Check that hdmstream is sending absolute http(s) URLs.',
            };
        }

        if (!this.baseUrl) {
            throw new Error('PYTHON_AI_URL is not configured');
        }

        const payload = {
            fieldId,
            cropType,
            frames: valid,
            maxGeminiCalls: maxGeminiCalls || 30,
            preFilterEnabled: preFilterEnabled ?? true,
            preFilterPercentage: preFilterPercentage || 60,
        };

        logger.info(`[FieldScan] POST ${this.baseUrl}/api/analyze/field-scan (validFrames=${valid.length})`);

        try {
            const startedAt = Date.now();
            const response = await axios.post(
                `${this.baseUrl}/api/analyze/field-scan`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                    },
                    timeout: 300000,
                }
            );
            logger.info(`[FieldScan] Python responded ${response.status} in ${Date.now() - startedAt}ms`);
            return response.data;
        } catch (error) {
            const status = error.response?.status;
            const body = error.response?.data;
            logger.error(`[FieldScan] Python call FAILED: ${error.message}`);
            if (status) logger.error(`[FieldScan] HTTP status: ${status}`);
            if (body) {
                const preview = typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300);
                logger.error(`[FieldScan] Response body: ${preview}`);
            }
            throw error;
        }
    }
}

module.exports = new FieldScanService();