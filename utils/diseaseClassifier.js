/**
 * Single source of truth for classifying AI-returned disease strings.
 *
 * Mirrors api/utils/disease_classifier.py and the client classifier —
 * same rules, same precedence. Update all 3 in lockstep.
 *
 * Precedence (first match wins):
 *   1. NO_CROP patterns          ("no plant detected")
 *   2. DISEASE keywords          (beats "no clear" hedging)
 *   3. HEALTHY patterns          (includes hedged healthy phrasings)
 *   4. INCONCLUSIVE patterns     (uncertain / unclear / etc.)
 *   5. Default → INCONCLUSIVE    (unknown string never auto-disease)
 */

const CATEGORIES = Object.freeze({
    HEALTHY: 'healthy',
    INCONCLUSIVE: 'inconclusive',
    NO_CROP: 'no_crop',
    DISEASE: 'disease',
});

const NO_CROP_PATTERNS = [
    'no plant detected', 'no plant',
    'no crop detected', 'no crop',
    'non-crop', 'non crop', 'not a plant',
    'no vegetation', 'n/a (non-crop image)',
];

const DISEASE_KEYWORDS = [
    'blight', 'rust', 'spot', 'rot', 'wilt', 'mildew', 'mosaic',
    'virus', 'bacter', 'fung', 'mold', 'mould',
    'leaf miner', 'aphid', 'thrip', 'weevil', 'borer',
    'caterpillar', 'worm', 'beetle', 'mite', 'nematode',
    'deficiency', 'chlorosis', 'necrosis',
    'canker', 'galling', 'gummosis', 'scab', 'smut', 'anthracnose',
];

const HEALTHY_PATTERNS = [
    'healthy', 'no disease', 'no issues', 'no symptoms', 'clean',
    'no clear disease', 'no clear symptoms', 'no obvious signs',
    'no definitive pathology', 'no visible disease', 'no visible symptoms',
    'no sign of disease', 'no pathology',
    'appears healthy', 'looks healthy', 'appears normal', 'looks normal',
];

const INCONCLUSIVE_PATTERNS = [
    'uncertain', 'unclear', 'unknown', 'no clear', 'inconclusive',
    'pending', 'analysis failed', 'n/a', 'none',
];

function _containsAny(text, patterns) {
    return patterns.some((p) => text.includes(p));
}

function classifyDisease(raw) {
    if (raw == null) {
        return { category: CATEGORIES.INCONCLUSIVE, value: 'Uncertain', raw: '' };
    }
    const trimmed = String(raw).trim();
    if (!trimmed) {
        return { category: CATEGORIES.INCONCLUSIVE, value: 'Uncertain', raw: '' };
    }
    const lower = trimmed.toLowerCase();

    if (_containsAny(lower, NO_CROP_PATTERNS)) {
        return { category: CATEGORIES.NO_CROP, value: 'No crop detected', raw: trimmed };
    }

    if (_containsAny(lower, DISEASE_KEYWORDS)) {
        return { category: CATEGORIES.DISEASE, value: trimmed, raw: trimmed };
    }

    if (HEALTHY_PATTERNS.some((p) => lower === p || lower.includes(p))) {
        return { category: CATEGORIES.HEALTHY, value: 'Healthy', raw: trimmed };
    }

    if (_containsAny(lower, INCONCLUSIVE_PATTERNS)) {
        return { category: CATEGORIES.INCONCLUSIVE, value: 'Uncertain', raw: trimmed };
    }

    return { category: CATEGORIES.INCONCLUSIVE, value: 'Uncertain', raw: trimmed };
}

function isRealDisease(raw) {
    return classifyDisease(raw).category === CATEGORIES.DISEASE;
}

module.exports = { classifyDisease, isRealDisease, CATEGORIES };