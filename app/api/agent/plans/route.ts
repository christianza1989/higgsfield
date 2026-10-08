import { agentJson, assertAgentRequest, AgentError, parseAgentBrief, saveAgentBrief } from '@/lib/agent-plans';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  try { const origin = assertAgentRequest(req, true); return Response.json(saveAgentBrief(parseAgentBrief(await agentJson(req)), origin), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return Response.json({ error: e instanceof Error && 'status' in e ? e.message : 'Could not prepare the agent plan.' }, { status: e instanceof Error && 'status' in e ? Number((e as AgentError).status) : 500 }); }
}
