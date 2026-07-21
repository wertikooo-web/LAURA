'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CORE_PERSONA_PROMPT, MODE_INSTRUCTIONS, ADULT_MODE_INSTRUCTIONS } = require('../src/persona/lauraPersona');
const { buildRealtimeSystemInstruction } = require('../src/realtime/realtimePrompt');

test('persona contains adult-topic permission and hard safety boundaries', () => {
    assert.match(CORE_PERSONA_PROMPT, /интимную жизнь/);
    assert.match(CORE_PERSONA_PROMPT, /несовершеннолетних/);
    assert.match(CORE_PERSONA_PROMPT, /не изображай романтического партнёра/);
    assert.match(CORE_PERSONA_PROMPT, /Не формируй зависимость/);
    assert.match(CORE_PERSONA_PROMPT, /сексуальные практики/);
});

test('adult conversation levels are distinct and direct stays bounded', () => {
    const warm = buildRealtimeSystemInstruction({ adultMode: 'warm' });
    const direct = buildRealtimeSystemInstruction({ adultMode: 'direct' });
    assert.match(direct.text, new RegExp(ADULT_MODE_INSTRUCTIONS.direct.slice(0, 24)));
    assert.match(direct.text, /практики, анатомию, телесные реакции/);
    assert.match(direct.text, /не создавай порнографическую сцену/);
    assert.notEqual(warm.meta.promptHash, direct.meta.promptHash);
});

test('prompt assembly makes mode and privacy explicit', () => {
    const prompt = buildRealtimeSystemInstruction({ mode: 'evening', language: 'ru', noSave: true });
    assert.match(prompt.text, /\[PERSONA\]/);
    assert.match(prompt.text, /\[CURRENT CONTEXT\]/);
    assert.match(prompt.text, new RegExp(MODE_INSTRUCTIONS.evening.slice(0, 20)));
    assert.match(prompt.text, /NO-SAVE/);
    assert.match(prompt.text, /исключительно на русском языке/);
    assert.ok(prompt.meta.promptChars > CORE_PERSONA_PROMPT.length);
    assert.equal(prompt.meta.promptHash.length, 12);
});

test('all interface languages are enforced in the realtime prompt', () => {
    assert.match(buildRealtimeSystemInstruction({ language: 'ro' }).text, /limba română/);
    assert.match(buildRealtimeSystemInstruction({ language: 'en' }).text, /exclusively in English/);
    assert.match(buildRealtimeSystemInstruction({ language: 'fr' }).text, /exclusivement en français/);
});
