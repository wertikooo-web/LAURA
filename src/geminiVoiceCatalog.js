'use strict';

// Google publishes style descriptions rather than voice genders. This is the
// product's curated set of feminine-sounding Live voices from that catalog.
const GEMINI_VOICES = Object.freeze([
    { id: 'Achernar', label: 'Achernar · Soft' },
    { id: 'Aoede', label: 'Aoede · Breezy' },
    { id: 'Autonoe', label: 'Autonoe · Bright' },
    { id: 'Callirrhoe', label: 'Callirrhoe · Easy-going' },
    { id: 'Despina', label: 'Despina · Smooth' },
    { id: 'Erinome', label: 'Erinome · Clear' },
    { id: 'Gacrux', label: 'Gacrux · Mature' },
    { id: 'Kore', label: 'Kore · Firm' },
    { id: 'Laomedeia', label: 'Laomedeia · Upbeat' },
    { id: 'Leda', label: 'Leda · Youthful' },
    { id: 'Pulcherrima', label: 'Pulcherrima · Forward' },
    { id: 'Sulafat', label: 'Sulafat · Warm' },
    { id: 'Vindemiatrix', label: 'Vindemiatrix · Gentle' },
    { id: 'Zephyr', label: 'Zephyr · Bright' },
]);

const GEMINI_VOICE_IDS = new Set(GEMINI_VOICES.map(({ id }) => id));

function normalizeGeminiVoice(value, fallback = 'Aoede') {
    const requested = String(value || '').trim().toLowerCase();
    return GEMINI_VOICES.find(({ id }) => id.toLowerCase() === requested)?.id || fallback;
}

module.exports = { GEMINI_VOICES, GEMINI_VOICE_IDS, normalizeGeminiVoice };
