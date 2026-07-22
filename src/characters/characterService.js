'use strict';

const { normalizeProfile, normalizeScenario, validateCharacterId, validateDeviceId, MAX_USER_CHARACTERS, MAX_SCENARIOS, LAURA_CHARACTER_ID, error } = require('./characterModel');
const { buildCharacterPrompt, createSnapshot } = require('./characterPromptBuilder');

function deepMerge(base, patch) { if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch === undefined ? base : patch; const result={...(base||{})}; for(const [key,value] of Object.entries(patch)) result[key]=value&&typeof value==='object'&&!Array.isArray(value)?deepMerge(base?.[key],value):value; return result; }
function relation(input={},current={}) { const number=(key,fallback)=>{const value=input[key]??current[key]??fallback; const n=Number(value); if(!Number.isFinite(n)||n<0||n>1)throw error('invalid_relationship_value'); return n;}; return { familiarity:number('familiarity',0),trustLevel:number('trustLevel',0),humorLevel:number('humorLevel',.5),directnessPreference:number('directnessPreference',.5),initiativePreference:number('initiativePreference',.3),preferredResponseLength:['very_short','short','medium','long'].includes(input.preferredResponseLength)?input.preferredResponseLength:(current.preferredResponseLength||'short'),allowedTopics:Array.isArray(input.allowedTopics)?input.allowedTopics.slice(0,20):(current.allowedTopics||[]),avoidedTopics:Array.isArray(input.avoidedTopics)?input.avoidedTopics.slice(0,20):(current.avoidedTopics||[]),customData:input.customData&&typeof input.customData==='object'?input.customData:(current.customData||{}) }; }

class CharacterService {
    constructor(store){this.store=store;this.available=store.available;this.persistence=store.persistence;}
    async list(deviceId){return this.store.list(validateDeviceId(deviceId));}
    async get(deviceId,id){return this.store.get(validateDeviceId(deviceId),validateCharacterId(id));}
    async create(deviceId,input){deviceId=validateDeviceId(deviceId);const owned=(await this.store.list(deviceId)).filter(x=>!x.isSystemCharacter);if(owned.length>=MAX_USER_CHARACTERS)throw error('character_limit_reached');return this.store.create(deviceId,normalizeProfile(input));}
    async update(deviceId,id,patch){const current=await this.get(deviceId,id);if(!current)throw error('character_not_found');if(current.isSystemCharacter)throw error('system_character_protected');return this.store.update(deviceId,id,normalizeProfile(deepMerge(current,patch)));}
    async archive(deviceId,id){return this.update(deviceId,id,{status:'archived'});}
    async delete(deviceId,id){if(id===LAURA_CHARACTER_ID)throw error('system_character_protected');return this.store.delete(validateDeviceId(deviceId),validateCharacterId(id));}
    async duplicate(deviceId,id){const source=await this.get(deviceId,id);if(!source)throw error('character_not_found');const copy=normalizeProfile({...source,name:`${source.name} Copy`,slug:undefined,status:'draft'});const created=await this.create(deviceId,copy);for(const scenario of (await this.store.listScenarios(deviceId,id)||[])){const {id:ignored,characterId,...draft}=scenario;await this.store.createScenario(deviceId,created.id,normalizeScenario(draft));}return created;}
    async listScenarios(deviceId,id){const result=await this.store.listScenarios(validateDeviceId(deviceId),validateCharacterId(id));if(!result)throw error('character_not_found');return result;}
    async createScenario(deviceId,id,input){const current=await this.listScenarios(deviceId,id);if(current.length>=MAX_SCENARIOS)throw error('scenario_limit_reached');return this.store.createScenario(deviceId,id,normalizeScenario(input));}
    async updateScenario(deviceId,id,scenarioId,input){validateCharacterId(scenarioId);const current=(await this.listScenarios(deviceId,id)).find(x=>x.id===scenarioId);if(!current)throw error('scenario_not_found');return this.store.updateScenario(deviceId,id,scenarioId,normalizeScenario(deepMerge(current,input)));}
    async deleteScenario(deviceId,id,scenarioId){return this.store.deleteScenario(validateDeviceId(deviceId),validateCharacterId(id),validateCharacterId(scenarioId));}
    async getRelationship(deviceId,id){const value=await this.store.getRelationship(validateDeviceId(deviceId),validateCharacterId(id));if(!value)throw error('character_not_found');return value;}
    async updateRelationship(deviceId,id,input){const current=await this.getRelationship(deviceId,id);return this.store.updateRelationship(deviceId,id,relation(input,current));}
    async getSessionContext(deviceId,characterId=LAURA_CHARACTER_ID,scenarioId){const character=await this.get(deviceId,characterId);if(!character||character.status==='archived')throw error('character_not_found');let scenario=null;if(scenarioId){validateCharacterId(scenarioId);scenario=(await this.listScenarios(deviceId,character.id)).find(x=>x.id===scenarioId&&x.enabled);if(!scenario)throw error('scenario_not_found');}const relationship=await this.getRelationship(deviceId,character.id);return {character,scenario,relationship,characterPrompt:buildCharacterPrompt({character,scenario,relationship})};}
    async saveSnapshot(sessionId,deviceId,context,{voice,provider,promptHash}){const snapshot=createSnapshot({...context,voice,provider,promptHash});await this.store.saveSnapshot(sessionId,deviceId,context.character.id,snapshot);return snapshot;}
    async close(){return this.store.close?.();}
}
module.exports={CharacterService,deepMerge};
