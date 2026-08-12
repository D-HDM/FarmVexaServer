const weatherService = require('../../services/weatherService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getFarmWeather = asyncHandler(async (req, res) => {
    const weather = await weatherService.getFarmWeather(req.params.farmId);
    if (!weather) return errorResponse(res, 'No weather data. Refresh to fetch.', 404);
    return successResponse(res, { weather });
});

const refreshWeather = asyncHandler(async (req, res) => {
    const weather = await weatherService.fetchForFarm(req.params.farmId);
    return successResponse(res, { weather }, 'Weather refreshed');
});

module.exports = { getFarmWeather, refreshWeather };