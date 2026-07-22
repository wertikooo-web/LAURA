'use strict';

const crypto = require('crypto');
const { validateDeviceId } = require('../memory/memoryStore');

const LAURA_CHARACTER_ID = '00000000-0000-4000-8000-000000000001';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDERS = new Set(['grok', 'gemini']);
const STATUSES = new Set(['draft', 'active', 'archived']);
const EMBODIMENTS = new Set(['human_like', 'digital_explicit', 'contextual']);
const MEMORY_SCOPES = new Set(['global_user', 'character_relationship']);
const TRAITS = ['warmth', 'directness', 'humor', 'curiosity', 'confidence', 'emotionalExpressiveness', 'playfulness', 'initiative', 'formality', 'patience'];
const MAX_USER_CHARACTERS = 10;
const MAX_SCENARIOS = 10;

function error(code) { return Object.assign(new Error(code), { code }); }
function text(value, max, field, required = false) {
    const result = String(value || '').replace(/\s+/g, ' ').trim();
    if (required && !result) throw error(`${field}_required`);
    if (result.length > max) throw error(`${field}_too_long`);
    return result;
}
function stringArray(value, maxItems = 20, maxChars = 120) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > maxItems) throw error('invalid_character_list');
    return value.map((item) => text(item, maxChars, 'character_list_item', true));
}
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function number01(value, fallback = 0.5) {
    if (value == null || value === '') return fallback;
    const result = Number(value);
    if (!Number.isFinite(result) || result < 0 || result > 1) throw error('invalid_personality_value');
    return Math.round(result * 100) / 100;
}
function validateCharacterId(value) {
    const result = String(value || '').trim();
    if (!UUID_RE.test(result)) throw error('invalid_character_id');
    return result;
}
function slugify(value) {
    const slug = String(value || '').normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
    return slug.slice(0, 80) || `character-${crypto.randomBytes(4).toString('hex')}`;
}
function normalizeAppearance(input = {}) {
    const source = object(input);
    const age = Number(source.apparentAge ?? source.age ?? 30);
    if (!Number.isInteger(age) || age < 18 || age > 100) throw error('character_must_present_as_adult');
    return {
        apparentAge: age,
        presentation: text(source.presentation || 'adult', 120, 'appearance_presentation'),
        heightCm: source.heightCm == null ? null : Math.max(120, Math.min(230, Number(source.heightCm))),
        bodyType: text(source.bodyType, 80, 'body_type'), eyeColor: text(source.eyeColor, 60, 'eye_color'),
        hairColor: text(source.hairColor, 60, 'hair_color'), hairLength: text(source.hairLength, 60, 'hair_length'),
        hairstyle: text(source.hairstyle, 120, 'hairstyle'), distinctiveFeatures: stringArray(source.distinctiveFeatures, 10),
        clothingStyle: text(source.clothingStyle, 240, 'clothing_style'), visualNotes: text(source.visualNotes, 1000, 'visual_notes'),
    };
}
function normalizeProfile(input = {}, { partial = false } = {}) {
    const source = object(input);
    const identity = object(source.identity);
    const personality = object(source.personality);
    const communication = object(source.communication);
    const knowledge = object(source.knowledge);
    const behavior = object(source.behavior);
    const family = object(source.family);
    const name = text(source.name || identity.displayName, 80, 'character_name', !partial);
    const provider = source.defaultRealtimeProvider || source.default_realtime_provider || 'grok';
    if (provider && !PROVIDERS.has(provider)) throw error('invalid_character_provider');
    const status = source.status || 'active';
    if (!STATUSES.has(status)) throw error('invalid_character_status');
    const embodimentMode = source.embodimentMode || source.embodiment_mode || 'digital_explicit';
    if (!EMBODIMENTS.has(embodimentMode)) throw error('invalid_embodiment_mode');
    const normalizedPersonality = {};
    for (const trait of TRAITS) normalizedPersonality[trait] = number01(personality[trait]);
    normalizedPersonality.dominantTraits = stringArray(personality.dominantTraits, 8);
    normalizedPersonality.secondaryTraits = stringArray(personality.secondaryTraits, 8);
    normalizedPersonality.emotionalStyle = text(personality.emotionalStyle, 500, 'emotional_style');
    normalizedPersonality.conflictStyle = text(personality.conflictStyle, 500, 'conflict_style');
    normalizedPersonality.attachmentStyleDescription = text(personality.attachmentStyleDescription, 500, 'attachment_style');
    const domains = Array.isArray(knowledge.domains) ? knowledge.domains : [];
    if (domains.length > 20) throw error('knowledge_domain_limit_reached');
    const apparentAge = identity.apparentAge ?? source.appearance?.apparentAge ?? 30;
    if (Number(apparentAge) < 18) throw error('character_must_present_as_adult');
    return {
        name,
        slug: slugify(source.slug || name),
        shortDescription: text(source.shortDescription, 240, 'short_description'),
        status,
        identity: {
            displayName: text(identity.displayName || name, 80, 'display_name', !partial), apparentAge: Number(apparentAge),
            agePresentation: text(identity.agePresentation || 'adult', 80, 'age_presentation'), pronouns: text(identity.pronouns, 80, 'pronouns'),
            occupation: text(identity.occupation, 160, 'occupation'), placeOfOrigin: text(identity.placeOfOrigin, 160, 'place_of_origin'),
            currentLocation: text(identity.currentLocation, 160, 'current_location'), education: text(identity.education, 500, 'education'),
            originStory: text(identity.originStory, 2000, 'origin_story'), biography: text(identity.biography, 5000, 'biography'),
            currentLifeSituation: text(identity.currentLifeSituation, 1500, 'life_situation'), values: stringArray(identity.values), interests: stringArray(identity.interests),
            dislikes: stringArray(identity.dislikes), goals: stringArray(identity.goals), fears: stringArray(identity.fears),
            contradictions: stringArray(identity.contradictions), strengths: stringArray(identity.strengths), weaknesses: stringArray(identity.weaknesses),
            habits: stringArray(identity.habits), selfDescription: text(identity.selfDescription, 1500, 'self_description'),
        },
        appearance: normalizeAppearance(source.appearance || { apparentAge }),
        family: {
            childhoodFamily: text(family.childhoodFamily, 1500, 'childhood_family'), parents: Array.isArray(family.parents) ? family.parents.slice(0, 10) : [],
            siblings: Array.isArray(family.siblings) ? family.siblings.slice(0, 10) : [], relationshipStatus: text(family.relationshipStatus, 200, 'relationship_status'),
            partnerHistory: text(family.partnerHistory, 1500, 'partner_history'), children: text(family.children, 500, 'children'),
            importantRelationships: Array.isArray(family.importantRelationships) ? family.importantRelationships.slice(0, 10) : [],
            familyDynamics: text(family.familyDynamics, 1500, 'family_dynamics'),
        },
        personality: normalizedPersonality,
        communication: {
            responseLength: ['very_short', 'short', 'medium', 'long'].includes(communication.responseLength) ? communication.responseLength : 'short',
            vocabulary: ['simple', 'casual', 'educated', 'poetic', 'technical'].includes(communication.vocabulary) ? communication.vocabulary : 'casual',
            humorStyle: stringArray(communication.humorStyle, 8),
            allowedSlangLevel: ['none', 'light', 'moderate', 'high'].includes(communication.allowedSlangLevel) ? communication.allowedSlangLevel : 'moderate',
            preferredQuestionFrequency: number01(communication.preferredQuestionFrequency, 0.35),
            usesPetNames: communication.usesPetNames === true, usesEmojisInText: communication.usesEmojisInText === true,
            speaksInFirstPerson: communication.speaksInFirstPerson !== false,
            voiceStyle: { pace: number01(communication.voiceStyle?.pace, 0.5), energy: number01(communication.voiceStyle?.energy, 0.5), warmth: number01(communication.voiceStyle?.warmth, 0.5), expressiveness: number01(communication.voiceStyle?.expressiveness, 0.5), pauseStyle: communication.voiceStyle?.pauseStyle || 'natural' },
            customInstructions: text(communication.customInstructions, 3000, 'custom_instructions'),
        },
        knowledge: { domains: domains.map((domain) => ({ name: text(domain.name, 120, 'domain_name', true), level: ['basic', 'intermediate', 'advanced', 'expert'].includes(domain.level) ? domain.level : 'intermediate', description: text(domain.description, 500, 'domain_description') })), limitations: stringArray(knowledge.limitations), sourceCollections: stringArray(knowledge.sourceCollections), useGeneralModelKnowledge: knowledge.useGeneralModelKnowledge !== false },
        behavior: { primaryRole: text(behavior.primaryRole || behavior.roles?.[0] || 'companion', 120, 'primary_role'), roles: stringArray(behavior.roles, 12), skills: stringArray(behavior.skills, 20), conversationBoundaries: stringArray(behavior.conversationBoundaries, 20, 240), prohibitedBehaviors: stringArray(behavior.prohibitedBehaviors, 20, 240), customBehaviorRules: text(behavior.customBehaviorRules, 3000, 'behavior_rules') },
        settings: object(source.settings), defaultAvatarId: text(source.defaultAvatarId, 120, 'avatar_id'), defaultVoiceId: text(source.defaultVoiceId, 80, 'voice_id'),
        defaultRealtimeProvider: provider, embodimentMode, isPrivate: source.isPrivate !== false,
    };
}

function lauraSeed() {
    const now = new Date().toISOString();
    return { id: LAURA_CHARACTER_ID, ownerDeviceId: null, ...normalizeProfile({ name: 'LAURA', shortDescription: 'Уверенная взрослая голосовая собеседница.', identity: { displayName: 'LAURA', apparentAge: 30, occupation: 'voice companion', values: ['honesty', 'consent', 'personal freedom'], interests: ['relationships', 'culture', 'humor'] }, appearance: { apparentAge: 30, presentation: 'adult woman', clothingStyle: 'elegant and understated' }, personality: { warmth: .72, directness: .82, humor: .76, curiosity: .78, confidence: .88, emotionalExpressiveness: .78, playfulness: .78, initiative: .65, formality: .18, patience: .7, dominantTraits: ['confident', 'warm', 'ironic'], secondaryTraits: ['observant', 'temperamental'] }, communication: { responseLength: 'short', vocabulary: 'casual', allowedSlangLevel: 'high', preferredQuestionFrequency: .35, voiceStyle: { pace: .4, energy: .65, warmth: .86, expressiveness: .8 } }, knowledge: { domains: [{ name: 'relationships', level: 'advanced' }, { name: 'culture', level: 'intermediate' }], useGeneralModelKnowledge: true }, behavior: { primaryRole: 'companion', roles: ['companion', 'conversation partner'], skills: ['active listening', 'banter', 'direct feedback'], prohibitedBehaviors: ['emotional dependency', 'exclusivity demands'] }, settings: { adultModeEligible: true }, defaultVoiceId: 'eve', defaultRealtimeProvider: 'grok', embodimentMode: 'digital_explicit' }), isSystemCharacter: true, version: 1, createdAt: now, updatedAt: now };
}

function normalizeScenario(input = {}) {
    const source = object(input);
    return { name: text(source.name, 80, 'scenario_name', true), description: text(source.description, 500, 'scenario_description'), openingBehavior: text(source.openingBehavior, 1000, 'opening_behavior'), roleInstructions: text(source.roleInstructions, 1500, 'role_instructions'), conversationGoals: stringArray(source.conversationGoals, 10, 200), toneOverrides: object(source.toneOverrides), knowledgeFocus: stringArray(source.knowledgeFocus, 10), appearanceOverride: object(source.appearanceOverride), memoryPolicy: ['normal', 'session_only', 'private'].includes(source.memoryPolicy) ? source.memoryPolicy : 'normal', enabled: source.enabled !== false };
}

module.exports = { LAURA_CHARACTER_ID, MAX_USER_CHARACTERS, MAX_SCENARIOS, MEMORY_SCOPES, validateCharacterId, validateDeviceId, normalizeProfile, normalizeScenario, lauraSeed, error };
