const axios = require('axios');
const { env } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Proxy provider tests to the FastAPI engine.
 *
 * FastAPI owns the actual AI calls (it holds the Gemini/HDM credentials),
 * so tests must run there. We just forward and normalize the response.
 */
class FastApiTestService {
    constructor() {
        this.baseUrl = env.pythonAiUrl;
        this.apiKey = env.internalApiKey;
        // HDM vision can take 60s+, Gemini rarely exceeds 30s.
        this.timeout = 180000;
    }

    _url(service, provider) {
        // FastAPI expects crop_scan / field_scan / chat.
        // Normalize crop/field aliases so old callers still work.
        const normalizedService = {
            crop: 'crop_scan',
            field: 'field_scan',
            chat: 'chat',
            crop_scan: 'crop_scan',
            field_scan: 'field_scan',
        }[service];
        if (!normalizedService) {
            throw new Error(`Unknown service: ${service}`);
        }
        return `${this.baseUrl}/api/admin/ai/test/${normalizedService}/${provider}`;
    }

    async test(service, provider, { message, imageBuffer, mimeType = 'image/jpeg', cropType = 'tomato' } = {}) {
        const url = this._url(service, provider);
        const startedAt = Date.now();

        try {
            let response;

            if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
                // Multipart form for vision tests
                const FormData = require('form-data');
                const form = new FormData();
                form.append('image', imageBuffer, {
                    filename: `test_${Date.now()}.jpg`,
                    contentType: mimeType,
                });
                if (message) form.append('message', message);
                if (cropType) form.append('cropType', cropType);

                response = await axios.post(url, form, {
                    headers: {
                        ...form.getHeaders(),
                        'x-api-key': this.apiKey,
                    },
                    timeout: this.timeout,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                });
            } else {
                // JSON form for chat tests
                const form = new URLSearchParams();
                if (message) form.append('message', message);

                response = await axios.post(url, form.toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'x-api-key': this.apiKey,
                    },
                    timeout: this.timeout,
                });
            }

            const elapsedMs = Date.now() - startedAt;
            const payload = response.data?.data || response.data || {};

            return {
                success: true,
                elapsedMs,
                model: payload.model || '',
                raw: payload,
            };
        } catch (err) {
            const elapsedMs = Date.now() - startedAt;
            const status = err.response?.status;
            const body = err.response?.data;

            const errorMessage =
                (typeof body === 'string' ? body : body?.message) ||
                err.message ||
                'Unknown error';

            logger.error(
                `FastAPI test failed: service=${service} provider=${provider} ` +
                `status=${status || 'n/a'} elapsedMs=${elapsedMs} err=${errorMessage}`
            );

            return {
                success: false,
                elapsedMs,
                status,
                error: errorMessage,
            };
        }
    }
}

module.exports = new FastApiTestService();