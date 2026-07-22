'use strict';

const test=require('node:test');const assert=require('node:assert/strict');
const {createServer}=require('../src/server');const {InMemoryMemoryStore}=require('../src/memory/memoryStore');const {InMemoryCharacterStore}=require('../src/characters/characterStore');
const DEVICE='5ed4148b-5df0-47f5-b634-8da80a6c681f';
async function request(base,path,{method='GET',body}={}){const response=await fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json','X-LAURA-DEVICE-ID':DEVICE},body:body&&JSON.stringify(body)});return{status:response.status,body:await response.json()};}
const draft={name:'Maya',shortDescription:'Travel companion',identity:{displayName:'Maya',apparentAge:31,biography:'Fictional traveler.'},appearance:{apparentAge:31,presentation:'adult woman'},personality:{warmth:.7,directness:.6,humor:.6,curiosity:.8,confidence:.7,emotionalExpressiveness:.6,playfulness:.6,initiative:.5,formality:.3,patience:.8},communication:{responseLength:'short',vocabulary:'casual'},knowledge:{domains:[{name:'travel',level:'advanced'}]},behavior:{primaryRole:'travel guide',roles:['travel guide']},defaultRealtimeProvider:'gemini',embodimentMode:'digital_explicit'};

test('character API CRUD and generation preview require an explicit save',async(t)=>{const generationProvider={name:'fixture',model:'fixture',available:true,async generateCharacter(){return{variants:[{character:draft,scenarios:[{name:'Trip planning'}],summary:'Preview'}]};}};const {server}=createServer({env:{REALTIME_PROVIDER:'mock',HOST:'127.0.0.1',NODE_ENV:'test'},memoryStore:new InMemoryMemoryStore(),characterStore:new InMemoryCharacterStore(),generationProvider});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections?.();server.close(resolve);}));const base=`http://127.0.0.1:${server.address().port}`;
    const before=await request(base,'/api/characters');assert.equal(before.body.items.length,1);
    const preview=await request(base,'/api/characters/generate',{method:'POST',body:{mode:'surprise_me'}});assert.equal(preview.status,200);assert.equal(preview.body.saved,false);
    assert.equal((await request(base,'/api/characters')).body.items.length,1);
    const created=await request(base,'/api/characters',{method:'POST',body:preview.body.variants[0].character});assert.equal(created.status,201);assert.equal(created.body.name,'Maya');
    const scenario=await request(base,`/api/characters/${created.body.id}/scenarios`,{method:'POST',body:{name:'Trip planning'}});assert.equal(scenario.status,201);
    const copy=await request(base,`/api/characters/${created.body.id}/duplicate`,{method:'POST'});assert.equal(copy.status,201);assert.match(copy.body.name,/Copy$/);
});
