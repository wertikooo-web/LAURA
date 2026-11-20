'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CORE_PERSONA_PROMPT, MODE_INSTRUCTIONS, ADULT_MODE_INSTRUCTIONS, VOICE_EXPRESSION_INSTRUCTIONS } = require('../src/persona/lauraPersona');
const { buildRealtimeSystemInstruction } = require('../src/realtime/realtimePrompt');

test('persona contains adult-topic permission and hard safety boundaries', () => {
    assert.match(CORE_PERSONA_PROMPT, /интимную жизнь/);
    assert.match(CORE_PERSONA_PROMPT, /несовершеннолетних/);
    assert.match(CORE_PERSONA_PROMPT, /вымышленный романтический или интимный ролевой диалог/);
    assert.match(CORE_PERSONA_PROMPT, /Не формируй зависимость/);
    assert.match(CORE_PERSONA_PROMPT, /сексуальные практики/);
    assert.match(CORE_PERSONA_PROMPT, /ЛА́ура/);
});

test('voice expression changes delivery instructions and preserves LAURA identity', () => {
    const calm = buildRealtimeSystemInstruction({ voiceExpression: 'calm', language: 'ru' });
    const passionate = buildRealtimeSystemInstruction({ voiceExpression: 'passionate', language: 'ru' });
    assert.match(passionate.text, new RegExp(VOICE_EXPRESSION_INSTRUCTIONS.passionate.slice(0, 24)));
    assert.match(passionate.text, /вдохи, выдохи, вздохи/);
    assert.match(passionate.text, /Всегда называй себя LAURA/);
    assert.notEqual(calm.meta.promptHash, passionate.meta.promptHash);
});

test('adult conversation levels are distinct and direct stays bounded', () => {
    const warm = buildRealtimeSystemInstruction({ adultMode: 'warm' });
    const direct = buildRealtimeSystemInstruction({ adultMode: 'direct' });
    assert.match(direct.text, new RegExp(ADULT_MODE_INSTRUCTIONS.direct.slice(0, 24)));
    assert.match(direct.text, /практики, анатомию, телесные реакции/);
    assert.match(direct.text, /согласованных взрослых вымышленных ролевых сценах/);
    assert.match(direct.text, /правил голосового провайдера/);
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

test('roleplay requests are allowed within provider boundaries while safety is retained', () => {
    const direct = buildRealtimeSystemInstruction({adultMode:'direct', language:'ru'}).text;
    assert.match(direct, /согласованн/);
    assert.match(direct, /от первого лица/);
    assert.match(direct, /несовершеннолетних/);
    assert.match(direct, /насилие без согласия/);
    assert.doesNotMatch(direct, /не участвуй в сексуальной ролевой игре/);
    assert.doesNotMatch(direct, /не разыгрывай сексуальную сцену/);
});
