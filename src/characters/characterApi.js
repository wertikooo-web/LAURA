'use strict';

const { validateDeviceId, validateCharacterId } = require('./characterModel');
function device(request){return validateDeviceId(request.headers['x-laura-device-id']);}
function status(error){if(['character_not_found','scenario_not_found'].includes(error.code))return 404;if(['character_limit_reached','scenario_limit_reached','system_character_protected'].includes(error.code))return 409;if(error.code==='character_generation_not_configured')return 503;if(/^(invalid_|character_.*_(required|too_long)|knowledge_domain_limit|memory_character|real_person_)/.test(String(error.code||'')))return 400;return 500;}

function createCharacterApi({service,generationService,sendJson,readJson}){
    return async function handle(request,response,url){
        if(!url.pathname.startsWith('/api/characters'))return false;
        try{
            const deviceId=device(request);
            if(url.pathname==='/api/characters/generate'&&request.method==='POST'){sendJson(response,200,await generationService.generate(await readJson(request,64*1024)));return true;}
            if(url.pathname==='/api/characters/generate/section'&&request.method==='POST'){sendJson(response,200,await generationService.regenerateSection(await readJson(request,64*1024)));return true;}
            if(url.pathname==='/api/characters'&&request.method==='GET'){sendJson(response,200,{items:await service.list(deviceId),persistence:service.persistence,generation:{available:generationService.available,provider:generationService.providerName,model:generationService.model}});return true;}
            if(url.pathname==='/api/characters'&&request.method==='POST'){sendJson(response,201,await service.create(deviceId,await readJson(request,64*1024)));return true;}
            let match=url.pathname.match(/^\/api\/characters\/([^/]+)\/duplicate$/);if(match&&request.method==='POST'){sendJson(response,201,await service.duplicate(deviceId,validateCharacterId(match[1])));return true;}
            match=url.pathname.match(/^\/api\/characters\/([^/]+)\/relationship$/);if(match){const id=validateCharacterId(match[1]);if(request.method==='GET'){sendJson(response,200,await service.getRelationship(deviceId,id));return true;}if(request.method==='PATCH'){sendJson(response,200,await service.updateRelationship(deviceId,id,await readJson(request)));return true;}}
            match=url.pathname.match(/^\/api\/characters\/([^/]+)\/scenarios(?:\/([^/]+))?$/);if(match){const id=validateCharacterId(match[1]);const scenarioId=match[2]&&validateCharacterId(match[2]);if(!scenarioId&&request.method==='GET'){sendJson(response,200,{items:await service.listScenarios(deviceId,id)});return true;}if(!scenarioId&&request.method==='POST'){sendJson(response,201,await service.createScenario(deviceId,id,await readJson(request)));return true;}if(scenarioId&&request.method==='PATCH'){sendJson(response,200,await service.updateScenario(deviceId,id,scenarioId,await readJson(request)));return true;}if(scenarioId&&request.method==='DELETE'){sendJson(response,200,{deleted:await service.deleteScenario(deviceId,id,scenarioId)});return true;}}
            match=url.pathname.match(/^\/api\/characters\/([^/]+)$/);if(match){const id=validateCharacterId(match[1]);if(request.method==='GET'){const item=await service.get(deviceId,id);sendJson(response,item?200:404,item||{error:'character_not_found'});return true;}if(request.method==='PATCH'){sendJson(response,200,await service.update(deviceId,id,await readJson(request,64*1024)));return true;}if(request.method==='DELETE'){sendJson(response,200,{deleted:await service.delete(deviceId,id)});return true;}}
            sendJson(response,405,{error:'method_not_allowed'});return true;
        }catch(error){sendJson(response,status(error),{error:error.code||'character_request_failed'});return true;}
    };
}
module.exports={createCharacterApi};
