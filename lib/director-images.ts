import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { AgentError } from './agent-plans';
import { ASSET_DIR, readAsset, saveAsset } from './reference-assets';
import { inspectMedia } from './media-tools';

export const DIRECTOR_IMAGE_MODEL='google/gemini-3.1-flash-image';
export async function createReferenceImage(prompt:string){
  const key=process.env.OPENROUTER_API_KEY;
  if(!key)throw new AgentError('Trūksta OpenRouter rakto nuorodų generavimui.',401);
  if(!prompt.trim()||prompt.length>3000)throw new AgentError('Netinkamas nuorodos aprašymas.');
  const dir=path.join(process.cwd(),'storage','director','image-attempts');fs.mkdirSync(dir,{recursive:true});
  const fingerprint=createHash('sha256').update(DIRECTOR_IMAGE_MODEL+':'+prompt).digest('hex'),file=path.join(dir,fingerprint+'.json');
  if(fs.existsSync(file)){
    const saved=JSON.parse(fs.readFileSync(file,'utf8'));
    if(saved.status==='completed')return readAsset(saved.assetId);
    throw new AgentError('Šios nuorodos ankstesnės užklausos baigtis nepatvirtinta. Patikrink OpenRouter istoriją; automatiškai nekartojame.',409);
  }
  fs.writeFileSync(file,JSON.stringify({model:DIRECTOR_IMAGE_MODEL,prompt,status:'pending'}),{flag:'wx'});
  let res:Response;
  try{res=await fetch('https://openrouter.ai/api/v1/images',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(150000),body:JSON.stringify({model:DIRECTOR_IMAGE_MODEL,prompt,aspect_ratio:'1:1',resolution:'1K',n:1})});}
  catch{throw new AgentError('Nuorodos generavimo baigtis nežinoma. Mokamos užklausos automatiškai nekartosime.',502);}
  if(!res.ok){fs.writeFileSync(file,JSON.stringify({model:DIRECTOR_IMAGE_MODEL,prompt,status:'rejected',httpStatus:res.status}));throw new AgentError(`Nuorodos generavimas atmestas (${res.status}). Automatinio pakartojimo nebus.`,502);}
  const data=await res.json(), encoded=data.data?.[0]?.b64_json;
  if(typeof encoded!=='string'||encoded.length>42*1024*1024)throw new AgentError('Nuorodos vaizdas negautas arba per didelis.',502);
  const bytes=Buffer.from(encoded,'base64');const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpg=bytes[0]===255&&bytes[1]===216;
  if(!png&&!jpg)throw new AgentError('Nuorodos vaizdo formatas nepalaikomas.',502);
  fs.mkdirSync(ASSET_DIR,{recursive:true});const assetId=randomUUID(),filename=assetId+(png?'.png':'.jpg'),target=path.join(process.cwd(),'storage','references',filename);
  fs.writeFileSync(target,bytes);const info=await inspectMedia(target);
  const asset={assetId,filename,kind:'image' as const,mime:png?'image/png':'image/jpeg',name:'AI sukurta nuoroda',url:'',localUrl:'/api/reference-assets/'+assetId,bytes:bytes.length,...info};saveAsset(asset);
  fs.writeFileSync(file,JSON.stringify({model:DIRECTOR_IMAGE_MODEL,prompt,status:'completed',assetId,costUsd:data.usage?.cost??null}));return asset;
}
