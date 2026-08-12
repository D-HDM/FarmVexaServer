const axios = require('axios');
const Weather = require('../models/farm/Weather');
const Farm = require('../models/farm/Farm');
const alertService = require('./alertService');
const logger = require('../utils/logger');

class WeatherService {
    constructor() {
        this.api = process.env.WEATHER_API || 'openweather';
        this.openWeatherKey = process.env.OPENWEATHER_API_KEY;
        this.weatherApiKey = process.env.WEATHERAPI_KEY;
    }

    async getCoordinates(farm) {
        if (farm.location?.coordinates?.lat && farm.location?.coordinates?.lng) {
            return { lat: farm.location.coordinates.lat, lon: farm.location.coordinates.lng };
        }

        const query = [farm.location?.county, farm.location?.subCounty, 'Kenya'].filter(Boolean).join(', ');

        if (query !== 'Kenya') {
            try {
                const res = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params: { q: query, format: 'json', limit: 1 },
                    headers: { 'User-Agent': 'FarmVexa/1.0' },
                });
                if (res.data.length > 0) {
                    return { lat: parseFloat(res.data[0].lat), lon: parseFloat(res.data[0].lon) };
                }
            } catch (err) {
                logger.warn(`Geocoding failed for ${query}: ${err.message}`);
            }
        }

        return {
            lat: parseFloat(process.env.DEFAULT_LAT) || -1.2833,
            lon: parseFloat(process.env.DEFAULT_LON) || 36.8167,
        };
    }

    async fetchForFarm(farmId) {
        const farm = await Farm.findById(farmId);
        if (!farm) throw new Error('Farm not found');

        const { lat, lon } = await this.getCoordinates(farm);
        let current, forecast;

        if (this.api === 'weatherapi') {
            const data = await this.fetchWeatherAPI(lat, lon);
            current = data.current;
            forecast = data.forecast;
        } else {
            current = await this.fetchOpenWeather(lat, lon);
            forecast = await this.fetchOpenMeteo(lat, lon);
        }

        return this.saveWeather(farmId, current, forecast);
    }

    async fetchWeatherAPI(lat, lon) {
        const res = await axios.get('https://api.weatherapi.com/v1/forecast.json', {
            params: { key: this.weatherApiKey, q: `${lat},${lon}`, days: 7 },
        });
        const d = res.data;
        return {
            current: {
                temp: d.current.temp_c, humidity: d.current.humidity,
                rainfall: d.current.precip_mm, windSpeed: d.current.wind_kph,
                condition: this.mapCondition(d.current.condition?.text),
            },
            forecast: d.forecast.forecastday.map((f) => ({
                date: f.date, tempMin: f.day.mintemp_c, tempMax: f.day.maxtemp_c,
                condition: this.mapCondition(f.day.condition?.text),
                rainfall: f.day.totalprecip_mm, humidity: f.day.avghumidity, windSpeed: f.day.maxwind_kph,
            })),
        };
    }

    async fetchOpenWeather(lat, lon) {
        const res = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
            params: { lat, lon, appid: this.openWeatherKey, units: 'metric' },
        });
        const d = res.data;
        return {
            temp: d.main.temp, humidity: d.main.humidity,
            rainfall: d.rain ? (d.rain['1h'] || 0) : 0,
            windSpeed: d.wind.speed * 3.6,
            condition: this.mapCondition(d.weather[0]?.main),
        };
    }

    async fetchOpenMeteo(lat, lon) {
        const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
            params: {
                latitude: lat, longitude: lon,
                daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weathercode',
                timezone: 'Africa/Nairobi', forecast_days: 7,
            },
        });
        const d = res.data.daily;
        return d.time.map((date, i) => ({
            date, tempMin: d.temperature_2m_min[i], tempMax: d.temperature_2m_max[i],
            condition: this.mapOpenMeteoCode(d.weathercode[i]),
            rainfall: d.precipitation_sum[i], humidity: null, windSpeed: d.wind_speed_10m_max[i],
        }));
    }

    async saveWeather(farmId, current, forecast) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tempMin = Math.min(...forecast.map((f) => f.tempMin));
        const tempMax = Math.max(...forecast.map((f) => f.tempMax));
        const todayForecast = forecast[0];

        const weather = await Weather.findOneAndUpdate(
            { farm: farmId, date: today },
            {
                farm: farmId, date: today,
                temperature: { min: tempMin, max: tempMax, avg: (current.temp + todayForecast?.tempMax + todayForecast?.tempMin) / 3 },
                humidity: current.humidity, rainfall: current.rainfall || todayForecast?.rainfall || 0,
                windSpeed: current.windSpeed, condition: current.condition,
                forecast: forecast.map((f) => ({
                    date: f.date, tempMin: f.tempMin, tempMax: f.tempMax,
                    condition: f.condition, rainfall: f.rainfall, humidity: f.humidity, windSpeed: f.windSpeed,
                })),
                alerts: this.generateAlerts(current, forecast),
                source: 'api',
            },
            { upsert: true, new: true },
        );

        await this.processAlerts(weather, farmId);
        return weather;
    }

    generateAlerts(current, forecast) {
        const alerts = [];
        const todayForecast = forecast[0];
        const rain = current.rainfall || todayForecast?.rainfall || 0;
        const tempMax = todayForecast?.tempMax || current.temp;
        const tempMin = todayForecast?.tempMin || current.temp;
        const wind = todayForecast?.windSpeed || current.windSpeed;

        if (rain > 10) alerts.push({ type: 'rain', severity: 'medium', message: `Heavy rain expected (${rain}mm).`, recommendation: 'Protect young crops. Delay fertilizer and pesticide application.', validFrom: new Date(), validTo: new Date(Date.now() + 86400000) });
        if (tempMax > 35) alerts.push({ type: 'heatwave', severity: 'high', message: `High temperatures (${tempMax}°C).`, recommendation: 'Increase irrigation. Provide shade for poultry and young animals.', validFrom: new Date(), validTo: new Date(Date.now() + 172800000) });
        if (tempMin < 2) alerts.push({ type: 'frost', severity: 'high', message: `Low temperatures (${tempMin}°C). Frost risk.`, recommendation: 'Protect young plants. Move sensitive animals indoors.', validFrom: new Date(), validTo: new Date(Date.now() + 86400000) });
        if (forecast.filter((f) => f.rainfall < 1).length >= 7) alerts.push({ type: 'drought', severity: 'medium', message: 'No significant rain expected for 7+ days.', recommendation: 'Plan for increased irrigation. Conserve water.', validFrom: new Date(), validTo: new Date(Date.now() + 604800000) });
        if (wind > 30) alerts.push({ type: 'storm', severity: 'medium', message: `Strong winds (${wind} km/h).`, recommendation: 'Secure loose items. Protect young crops.', validFrom: new Date(), validTo: new Date(Date.now() + 86400000) });

        return alerts;
    }

    async processAlerts(weather, farmId) {
        for (const alert of weather.alerts) {
            await alertService.createAlert({
                farm: farmId, type: `weather_${alert.type}`, severity: alert.severity,
                message: alert.message, recommendation: alert.recommendation,
                data: { type: alert.type, severity: alert.severity },
            }).catch(() => {});
        }
    }

    mapCondition(text) {
        const t = text?.toLowerCase() || '';
        if (t.includes('rain') || t.includes('drizzle')) return 'rainy';
        if (t.includes('cloud')) return 'cloudy';
        if (t.includes('storm') || t.includes('thunder')) return 'stormy';
        if (t.includes('clear') || t.includes('sun')) return 'sunny';
        if (t.includes('partly')) return 'partly_cloudy';
        return 'sunny';
    }

    mapOpenMeteoCode(code) {
        if (code <= 1) return 'sunny';
        if (code === 2) return 'partly_cloudy';
        if (code === 3) return 'cloudy';
        if (code >= 51 && code <= 67) return 'rainy';
        if (code >= 71 && code <= 77) return 'rainy';
        if (code >= 80 && code <= 82) return 'rainy';
        if (code >= 95) return 'stormy';
        return 'sunny';
    }

    async getFarmWeather(farmId) {
        return Weather.findOne({ farm: farmId }).sort({ date: -1 });
    }

    async fetchAllFarms() {
        const farms = await Farm.find({ status: 'active' });
        for (const farm of farms) {
            try {
                await this.fetchForFarm(farm._id);
                logger.info(`Weather updated: ${farm.name}`);
            } catch (err) {
                logger.error(`Weather fetch failed for ${farm.name}: ${err.message}`);
            }
        }
    }
}

module.exports = new WeatherService();