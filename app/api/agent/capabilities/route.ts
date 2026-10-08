import { assertAgentRequest } from '@/lib/agent-plans';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  try { assertAgentRequest(req); return Response.json({ schemaVersion: 1, localOnly: true,
    modelId: 'openrouter:bytedance/seedance-2.5', planning: '/api/agent/plans', generation: '/api/agent/plans/<id>/generate',
    voiceover: '/api/voiceover-import', documentation: '.agents/skills/video-agent/SKILL.md',
    limits: { durationSeconds: [4,30], resolution: ['480p','720p'], images: 30, assets: 50 },
    referenceAudio: { documented: true, liveVerified: false }, exactLipSync: false,
    vision: 'External agent reviews the pixels; the server binds that attestation to image hashes. No server-side vision model.',
    voiceManagement: 'Use Voiceovers; enrollment requires the speaker’s real consent recording.', generationStarted: false }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Agent access is local-only.' }, { status: 403 }); }
}
