'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { InMemoryCharacterStore } = require('../src/characters/characterStore');
const { CharacterService } = require('../src/characters/characterService');
const { LAURA_CHARACTER_ID } = require('../src/characters/characterModel');
const { buildCharacterPrompt } = require('../src/characters/characterPromptBuilder');
const { InMemoryMemoryStore } = require('../src/memory/memoryStore');

const DEVICE_A='5ed4148b-5df0-47f5-b634-8da80a6c681f';
const DEVICE_B='6ed4148b-5df0-47f5-b634-8da80a6c681f';
const profile=(name='Sofia')=>({name,shortDescription:'Wine and business critic',identity:{displayName:name,apparentAge:32,occupation:'wine consultant',biography:'A fictional consultant from a restaurant family.',interests:['wine','travel']},appearance:{apparentAge:32,presentation:'adult woman',clothingStyle:'understated'},personality:{warmth:.6,directness:.85,humor:.7,curiosity:.8,confidence:.8,emotionalExpressiveness:.6,playfulness:.5,initiative:.55,formality:.3,patience:.7,dominantTraits:['observant','ironic']},communication:{responseLength:'short',vocabulary:'educated',allowedSlangLevel:'moderate'},knowledge:{domains:[{name:'wine',level:'expert'}]},behavior:{primaryRole:'wine expert',roles:['wine expert'],skills:['critical review']},defaultRealtimeProvider:'gemini',embodimentMode:'digital_explicit'});

test('character lifecycle enforces ownership, versioning and protected LAURA',async()=>{
    const service=new CharacterService(new InMemoryCharacterStore());
    const created=await service.create(DEVICE_A,profile());
    assert.equal(created.version,1);assert.equal(created.ownerDeviceId,DEVICE_A);
    assert.equal(await service.get(DEVICE_B,created.id),null);
    const updated=await service.update(DEVICE_A,created.id,{identity:{biography:'Updated fictional biography.'}});
    assert.equal(updated.version,2);assert.equal(updated.identity.biography,'Updated fictional biography.');assert.equal(updated.identity.occupation,'wine consultant');
    await assert.rejects(()=>service.update(DEVICE_A,LAURA_CHARACTER_ID,{name:'Changed'}),{code:'system_character_protected'});
    const underage=profile('Underage');underage.identity.apparentAge=17;underage.appearance.apparentAge=17;
    await assert.rejects(()=>service.create(DEVICE_A,underage),{code:'character_must_present_as_adult'});
    assert.equal(await service.delete(DEVICE_A,created.id),true);
});

test('duplication copies profile and scenarios but starts without relationship state',async()=>{
    const service=new CharacterService(new InMemoryCharacterStore());
    const original=await service.create(DEVICE_A,profile());
    await service.createScenario(DEVICE_A,original.id,{name:'Business critic',roleInstructions:'Challenge assumptions.'});
    await service.updateRelationship(DEVICE_A,original.id,{familiarity:.8,trustLevel:.7});
    const copy=await service.duplicate(DEVICE_A,original.id);
    assert.notEqual(copy.id,original.id);assert.match(copy.name,/Copy$/);assert.equal(copy.status,'draft');
    assert.equal((await service.listScenarios(DEVICE_A,copy.id)).length,1);
    assert.equal((await service.getRelationship(DEVICE_A,copy.id)).familiarity,0);
});

test('scenario changes the prompt without rewriting the base profile and user data stays delimited',async()=>{
    const service=new CharacterService(new InMemoryCharacterStore());const character=await service.create(DEVICE_A,profile());
    const scenario=await service.createScenario(DEVICE_A,character.id,{name:'Business critic',roleInstructions:'Ask for evidence.'});
    const context=await service.getSessionContext(DEVICE_A,character.id,scenario.id);
    assert.match(context.characterPrompt,/Ask for evidence/);assert.match(context.characterPrompt,/temporary/);assert.match(context.characterPrompt,/<character_data>/);
    assert.equal((await service.get(DEVICE_A,character.id)).behavior.primaryRole,'wine expert');
});

test('global memory is shared while relationship memory is isolated by character',async()=>{
    const characterService=new CharacterService(new InMemoryCharacterStore());const memory=new InMemoryMemoryStore();
    const sofia=await characterService.create(DEVICE_A,profile('Sofia'));const maya=await characterService.create(DEVICE_A,profile('Maya'));
    await memory.create(DEVICE_A,'User name is Alex',{scope:'global_user'});
    await memory.create(DEVICE_A,'Inside joke with Sofia',{scope:'character_relationship',characterId:sofia.id});
    const sofiaItems=await memory.list(DEVICE_A,{characterId:sofia.id});const mayaItems=await memory.list(DEVICE_A,{characterId:maya.id});
    assert.deepEqual(sofiaItems.map(x=>x.content),['Inside joke with Sofia','User name is Alex']);
    assert.deepEqual(mayaItems.map(x=>x.content),['User name is Alex']);
});

test('character snapshot freezes version, scenario, provider and voice',async()=>{
    const store=new InMemoryCharacterStore();const service=new CharacterService(store);const character=await service.create(DEVICE_A,profile());const context=await service.getSessionContext(DEVICE_A,character.id);
    const snapshot=await service.saveSnapshot('session_test',DEVICE_A,context,{voice:'Aoede',provider:'gemini',promptHash:'abc'});
    assert.equal(snapshot.version,1);assert.equal(snapshot.voice,'Aoede');assert.equal(store.snapshots.get('session_test').snapshot.name,'Sofia');
});
