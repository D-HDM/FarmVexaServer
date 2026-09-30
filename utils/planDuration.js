const DURATION_MAP = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    yearly: 365,
    one_time: null,
};

const durationDaysFromInterval = (interval) => {
    if (!interval) return null;
    if (!(interval in DURATION_MAP)) return null;
    return DURATION_MAP[interval];
};

const expiryFromInterval = (interval, baseDate = new Date()) => {
    const days = durationDaysFromInterval(interval);
    if (days === null) return null;
    return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
};

module.exports = { DURATION_MAP, durationDaysFromInterval, expiryFromInterval };