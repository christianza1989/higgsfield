import { assertAgentRequest, getAgentPackage, AgentError } from '@/lib/agent-plans';
export const runtime = 'nodejs';
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try { const origin = assertAgentRequest(req); return Response.json(getAgentPackage((await context.params).id, origin), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return Response.json({ error: e instanceof Error && 'status' in e ? e.message : 'Could not read the agent plan.' }, { status: e instanceof Error && 'status' in e ? Number((e as AgentError).status) : 500 }); }
}
