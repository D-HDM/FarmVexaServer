const Settings = require('../../models/admin/Settings');
const weatherService = require('../../services/weatherService');
const axios = require('axios');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const runWeatherTest = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    if (!settings?.system?.weatherTest?.enabled) {
        return errorResponse(res, 'Weather testing is disabled', 400);
    }

    const locations = req.body.locations || ['Nairobi', 'Nakuru'];
    const allResults = [];

    for (const location of locations) {
        const results = [];

        // Test OpenWeather
        if (process.env.OPENWEATHER_API_KEY) {
            const start1 = Date.now();
            try {
                const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
                    params: { q: location, appid: process.env.OPENWEATHER_API_KEY, units: 'metric' },
                    timeout: 10000,
                });
                results.push({
                    api: 'openweather',
                    location,
                    status: 'success',
                    responseTime: Date.now() - start1,
                    data: {
                        temperature: response.data.main.temp,
                        humidity: response.data.main.humidity,
                        condition: response.data.weather[0]?.description,
                        windSpeed: response.data.wind.speed,
                        location: response.data.name,
                    },
                    testedAt: new Date(),
                });
            } catch (err) {
                results.push({
                    api: 'openweather',
                    location,
                    status: 'failed',
                    responseTime: Date.now() - start1,
                    error: err.response?.data?.message || err.message,
                    testedAt: new Date(),
                });
            }
        }

        // Test WeatherAPI
        if (process.env.WEATHERAPI_KEY) {
            const start2 = Date.now();
            try {
                const response = await axios.get('https://api.weatherapi.com/v1/current.json', {
                    params: { key: process.env.WEATHERAPI_KEY, q: location },
                    timeout: 10000,
                });
                results.push({
                    api: 'weatherapi',
                    location,
                    status: 'success',
                    responseTime: Date.now() - start2,
                    data: {
                        temperature: response.data.current.temp_c,
                        humidity: response.data.current.humidity,
                        condition: response.data.current.condition?.text,
                        windSpeed: response.data.current.wind_kph,
                        location: response.data.location?.name,
                    },
                    testedAt: new Date(),
                });
            } catch (err) {
                results.push({
                    api: 'weatherapi',
                    location,
                    status: 'failed',
                    responseTime: Date.now() - start2,
                    error: err.response?.data?.error?.message || err.message,
                    testedAt: new Date(),
                });
            }
        }

        allResults.push({ location, results });
    }

    settings.system.weatherTest.lastTested = new Date();
    settings.system.weatherTest.results = allResults;
    await settings.save();

    return successResponse(res, { locations, results: allResults }, 'Weather test completed');
});

const getWeatherTestResults = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    return successResponse(res, {
        enabled: settings?.system?.weatherTest?.enabled || false,
        location: settings?.system?.weatherTest?.location || '',
        lastTested: settings?.system?.weatherTest?.lastTested,
        results: settings?.system?.weatherTest?.results || [],
    });
});

module.exports = { runWeatherTest, getWeatherTestResults };