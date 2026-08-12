const formatDate = (date, format = 'full') => {
    const d = new Date(date);

    const formats = {
        full: d.toISOString(),
        readable: d.toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
        dateOnly: d.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' }),
        timeOnly: d.toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi' }),
        relative: getRelativeTime(d),
    };

    return formats[format] || formats.full;
};

const getRelativeTime = (date) => {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-KE');
};

module.exports = { formatDate };