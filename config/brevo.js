const axios = require('axios');

const sendSMS = async (to, message) => {
    try {
        const response = await axios.post(
            'https://api.brevo.com/v3/transactionalSMS/sms',
            {
                sender: process.env.SMS_FROM || 'FarmVexa',
                recipient: to,
                content: message,
            },
            {
                headers: {
                    'api-key': process.env.BREVO_API_KEY,
                    'Content-Type': 'application/json',
                },
                timeout: 10000,
            }
        );
        return response.data;
    } catch (error) {
        console.error('❌ SMS send failed:', error.message);
        throw error;
    }
};

module.exports = { sendSMS };