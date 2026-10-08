import { agentJson, assertAgentRequest } from '@/lib/agent-plans';
import { generateAgentPlan, parseAgentAuthorization, agentResponseError } from '@/lib/agent-generation';
export const runtime = 'nodejs';
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try { const origin = assertAgentRequest(req, true); return Response.json(await generateAgentPlan((await context.params).id, origin, parseAgentAuthorization(await agentJson(req)))); }
  catch (e) { return agentResponseError(e); }
}
