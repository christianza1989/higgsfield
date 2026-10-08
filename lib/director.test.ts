import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDirectorInput, composeDirectorPrompt } from './director';
import { acceptedCommonsLicense, commonsMediaUrl } from './director-location';
import { referenceInputs } from './video-references';
import type { DirectorInput } from './director-contract';

const input:DirectorInput={requestId:'12345678-1234-4234-a234-123456789abc',concept:'Street interview',dialogue:'Em... Aš rūpinuosi savo grožiu.',language:'lt',voiceMode:'recording',voiceId:'',recordingAssetId:'12345678-1234-4234-a234-123456789abd',location:'Vilnius Cathedral Square',locationMode:'real',weather:'Overcast',environment:'Distant pedestrians',camera:'Eye-level medium shot',aspectRatio:'9:16',resolution:'720p',duration:20,minimumLocationReferences:3,references:[]};
test('creator validates durations, roles and required media before AI or paid work',()=>{
  assert.deepEqual(parseDirectorInput(input),input);
  for(const bad of [{...input,recordingAssetId:''},{...input,duration:31},{...input,minimumLocationReferences:0},{...input,voiceMode:'clone',voiceId:''},{...input,references:[{assetId:input.recordingAssetId,role:'unknown',instruction:''}]},{...input,references:[{assetId:input.recordingAssetId,role:'face',instruction:'x'.repeat(281)}]}]) assert.throws(()=>parseDirectorInput(bad));
  assert.equal(parseDirectorInput({...input,voiceMode:'silent',dialogue:'',recordingAssetId:''}).voiceMode,'silent');
});
test('reference roles remain per media type and finished dialogue timing is not rounded in the edit',()=>{
  const refs=[{kind:'image' as const,url:'https://example.com/face.jpg',purpose:'Appearance only'},{kind:'image' as const,url:'https://example.com/microphone.jpg',purpose:'Microphone only'},{kind:'audio' as const,url:'https://example.com/dialogue.wav',duration:19.52,purpose:'Complete spoken dialogue'}];
  const prompt=composeDirectorPrompt(input,'One speaker answers a question.',input.dialogue,19.52,refs);
  assert.match(prompt,/@Image2: Microphone only/);assert.match(prompt,/@Audio1 supplies the complete spoken dialogue/);
  assert.match(prompt,/20-second/);assert.match(prompt,/ending to 19.52s/);assert.ok(prompt.includes(input.dialogue));
  assert.match(prompt,/breathing and hesitation timing/);assert.match(prompt,/Do not add a second ambience layer/);
  assert.deepEqual(referenceInputs(refs).at(-1),{type:'audio_url',audio_url:{url:'https://example.com/dialogue.wav'}});
  const silent=composeDirectorPrompt({...input,voiceMode:'silent',locationMode:'fantasy'},'Cloud city','',10,refs.slice(0,2));
  assert.match(silent,/fictional environment/);assert.match(silent,/Silent footage/);assert.ok(!silent.includes('DIALOGUE'));
  assert.ok(!silent.includes('Follow the complete recorded speech'));
  const clone=composeDirectorPrompt({...input,voiceMode:'clone'},'Outdoor interview',input.dialogue,19.52,refs);
  assert.match(clone,/dry voice track/);assert.match(clone,/quiet environmental sounds explicitly requested/);
});
test('location research accepts reusable licenses and rejects arbitrary image destinations',()=>{
  for(const license of ['CC BY-SA 4.0','CC BY 3.0','CC0','Public domain'])assert.equal(acceptedCommonsLicense(license),true);
  for(const license of ['All rights reserved','CC BY-NC 4.0','Unknown',''])assert.equal(acceptedCommonsLicense(license),false);
  assert.equal(commonsMediaUrl('https://upload.wikimedia.org/wikipedia/commons/a/a1/photo.jpg'),'https://upload.wikimedia.org/wikipedia/commons/a/a1/photo.jpg');
  assert.equal(commonsMediaUrl('https://thumb.wikimedia.org/wikipedia/commons/a/a1/photo.jpg'),'https://thumb.wikimedia.org/wikipedia/commons/a/a1/photo.jpg');
  for(const url of ['http://127.0.0.1/private','https://example.com/photo.jpg','https://upload.wikimedia.org.evil.test/wikipedia/commons/a.jpg','https://secret@upload.wikimedia.org/wikipedia/commons/a.jpg'])assert.throws(()=>commonsMediaUrl(url));
});
