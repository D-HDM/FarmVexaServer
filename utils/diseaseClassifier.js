/**
 * Single source of truth for classifying AI-returned disease strings.
 *
 * Mirrors api/utils/disease_classifier.py — same rules, same categories.
 * Every AI provider (Gemini, HDM, future) may return slightly different
 * strings; this normalizes them so downstream code never string-matches.
 *
 * Categories:
 *   healthy       - AI saw a plant, found no disease
 *   inconclusive  - AI saw a plant but couldn't commit
 *   no_crop       - AI saw no plant / non-crop image
 *   disease       - AI identified a specific disease
 */

const CATEGORIES = Object.freeze({
    HEALTHY: 'healthy',
    INCONCLUSIVE: 'inconclusive',
    NO_CROP: 'no_crop',
    DISEASE: 'disease',
});

// Order matters: most specific first.
const NO_CROP_PATTERNS = [
    'no plant detected',
    'no plant',
    'no crop detected',
    'no crop',
    'non-crop',
    'non crop',
    'not a plant',
    'no vegetation',
    'n/a (non-crop image)',
];

const INCONCLUSIVE_PATTERNS = [
    'uncertain',
    'unclear',
    'unknown',
    'no clear',
    'inconclusive',
    'pending',
    'analysis failed',
    'n/a',
    'none',
];

const HEALTHY_PATTERNS = [
    'healthy',
    'no disease',
    'no issues',
    'no symptoms',
    'clean',
];

function _containsAny(text, patterns) {
    return patterns.some((p) => text.includes(p));
}

/**
 * Classify an AI-returned disease string.
 * @param {string|null|undefined} raw
 * @returns {{ category: string, value: string, raw: string }}
 */
function classifyDisease(raw) {
    if (raw == null) {
        return { category: CATEGORIES.INCONCLUSIVE, value: 'Uncertain', raw: '' };
    }
    const trimmed = String(raw).trim();
    if (!trimmed) {
        return { category: CATEGORIES.INCONCLUSIVE, value: 'Uncertain', raw: '' };
    }
    const lower = trimmed.toLowerCase();

    // 1. No-crop first — must beat the generic "disease" fallback.
    if (_containsAny(lower, NO_CROP_PATTERNS)) {
        return { category: CATEGORIES.NO_CROP, value: 'No crop detected', raw: trimmed };
    }

    // 2. Healthy — before inconclusive so "healthy, no disease" stays green.
    if (HEALTHY_PATTERNS.some((p) => lower === p || lower.includes(p))) {
        return { category: CATEGORIES.HEALTHY, value: 'Healthy', raw: trimmed };
    }

    // 3. Inconclusive.
    if (_containsAny(lower, INCONCLUSIVE_PATTERNS)) {
        return { category: CATEGORIES.INCONCLUSIVE, value: 'Uncertain', raw: trimmed };
    }

    // 4. Anything else is a real disease name.
    return { category: CATEGORIES.DISEASE, value: trimmed, raw: trimmed };
}

function isRealDisease(raw) {
    return classifyDisease(raw).category === CATEGORIES.DISEASE;
}

module.exports = { classifyDisease, isRealDisease, CATEGORIES };