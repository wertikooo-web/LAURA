'use strict';

const SUPPORTED_LANGUAGES = Object.freeze(['ru', 'ro', 'en', 'fr']);
const FEMALE_VOICES = Object.freeze([
    { id: 'ara', label: 'Ara' },
    { id: 'carina', label: 'Carina' },
    { id: 'celeste', label: 'Celeste' },
    { id: 'eve', label: 'Eve' },
    { id: 'iris', label: 'Iris' },
    { id: 'luna', label: 'Luna' },
    { id: 'ursa', label: 'Ursa' },
]);

const FEMALE_VOICE_IDS = new Set(FEMALE_VOICES.map(({ id }) => id));
const PREVIEW_PHRASES = Object.freeze({
    ru: 'Привет. Я Лаура. Рада слышать твой голос.',
    ro: 'Bună. Sunt Laura. Mă bucur să-ți aud vocea.',
    en: 'Hello. I am Laura. It is good to hear your voice.',
    fr: 'Bonjour. Je suis Laura. Je suis heureuse d’entendre ta voix.',
});

function normalizeVoice(value, fallback = 'eve') {
    const voice = String(value || '').trim().toLowerCase();
    return FEMALE_VOICE_IDS.has(voice) ? voice : fallback;
}

module.exports = {
    SUPPORTED_LANGUAGES,
    FEMALE_VOICES,
    FEMALE_VOICE_IDS,
    PREVIEW_PHRASES,
    normalizeVoice,
};
