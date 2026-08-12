const axios = require('axios');

const sendEmail = async (to, subject, htmlBody, textBody = '') => {
    try {
        const response = await axios.post(
            `${process.env.HDM_API_URL}/emails/send`,
            {
                from: process.env.HDM_FROM_EMAIL,
                fromName: process.env.HDM_FROM_NAME,
                to,
                subject,
                htmlBody,
                textBody: textBody || htmlBody.replace(/<[^>]*>/g, ''),
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.HDM_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000,
            }
        );
        return response.data;
    } catch (error) {
        console.error('❌ Email send failed:', error.message);
        throw error;
    }
};

module.exports = { sendEmail };