const Redis = require('ioredis');

let redis = null;

const connectRedis = () => {
    if (process.env.REDIS_ENABLE !== 'true' || !process.env.REDIS_URL) {
        console.log('ℹ️  Redis Disabled');
        return null;
    }

    try {
        redis = new Redis(process.env.REDIS_URL, {
            retryStrategy: (times) => {
                if (times > 3) {
                    console.error('❌ Redis connection failed after 3 retries. Running without Redis.');
                    return null;
                }
                return Math.min(times * 200, 2000);
            },
            maxRetriesPerRequest: 1,
            lazyConnect: true,
        });

        redis.on('connect', () => {
            console.log('✅ Redis Connected');
        });

        redis.on('error', (err) => {
            console.error('❌ Redis Error:', err.message);
        });

        redis.connect().catch((err) => {
            console.error('❌ Redis connection failed:', err.message);
            redis = null;
        });
    } catch (err) {
        console.error('❌ Redis initialization failed:', err.message);
        redis = null;
    }

    return redis;
};

const getRedis = () => redis;

module.exports = { connectRedis, getRedis };