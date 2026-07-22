'use strict';

const crypto = require('crypto');
const { defaultPersonaPrompt, MODE_INSTRUCTIONS, ADULT_MODE_INSTRUCTIONS, VOICE_EXPRESSION_INSTRUCTIONS } = require('../persona/lauraPersona');

const PROMPT_MAX_CHARS = Math.max(4000, Number(process.env.PROMPT_MAX_CHARS || 24000));

function clean(value) {
    return String(value || '').trim();
}

function hashText(text) {
    return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex').slice(0, 12);
}

function withinLimit(text, label) {
    const value = clean(text);
    if (value.length > PROMPT_MAX_CHARS) {
        throw Object.assign(new Error(`${label}_too_long`), { code: `${label}_too_long` });
    }
    return value;
}

function languageInstruction(language) {
    if (language === 'ro') return 'Răspunde exclusiv în limba română. Nu schimba limba din cauza unor cuvinte sau nume străine.';
    if (language === 'en') return 'Reply exclusively in English. Do not switch languages because of foreign words or names.';
    if (language === 'fr') return 'Réponds exclusivement en français. Ne change pas de langue à cause de mots ou de noms étrangers.';
    return 'Отвечай исключительно на русском языке. Не меняй язык из-за отдельных иностранных слов или имён.';
}

function identityInstruction(language, characterName = 'LAURA') {
    if (String(characterName).toUpperCase() === 'LAURA') {
        if (language === 'ru') return 'Всегда называй себя LAURA. Произноси имя «ЛА́ура», с ударением на первом слоге; никогда «Лау́ра».';
        return 'Always call yourself LAURA. Pronounce LAURA with the stress on the first syllable.';
    }
    return `Always identify yourself as ${clean(characterName)}. Never claim to be LAURA or another character.`;
}

function buildRealtimeSystemInstruction({ mode = 'talk', adultMode = 'warm', voiceExpression = 'alive', language = 'ru', noSave = true, sessionMemory = null, characterPrompt = '', characterName = 'LAURA' } = {}) {
    const persona = withinLimit(characterPrompt || defaultPersonaPrompt(), 'persona');
    const context = [
        MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.talk,
        ADULT_MODE_INSTRUCTIONS[adultMode] || ADULT_MODE_INSTRUCTIONS.warm,
        VOICE_EXPRESSION_INSTRUCTIONS[voiceExpression] || VOICE_EXPRESSION_INSTRUCTIONS.alive,
        languageInstruction(language),
        identityInstruction(language, characterName),
        `Privacy for this session: ${noSave ? 'NO-SAVE. Do not store the current transcript or infer new memories. Explicitly saved facts may still be used.' : 'Memory may be used only after explicit user consent.'}`,
        sessionMemory ? `Consented memory relevant to this conversation:\n${clean(sessionMemory)}` : 'No consented long-term memory is available.',
    ].join('\n');
    const text = `[PERSONA]\n${persona}\n\n[CURRENT CONTEXT]\n${withinLimit(context, 'current_context')}`;
    return {
        text,
        meta: {
            promptChars: text.length,
            promptHash: hashText(text),
            personaHash: hashText(persona),
        },
    };
}

module.exports = { PROMPT_MAX_CHARS, buildRealtimeSystemInstruction, hashText };
