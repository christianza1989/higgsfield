import * as hf from "./higgsfield";
import * as or from "./openrouter";

export const providerName = (endpoint: string) => or.isOpenRouter(endpoint) ? "OpenRouter" : "Higgsfield";
export const hasCredentials = (endpoint: string) => or.isOpenRouter(endpoint) ? or.hasOpenRouterCredentials() : hf.hasCredentials();
export const estimate = (endpoint: string, body: Record<string, unknown>) => or.isOpenRouter(endpoint) ? or.estimateOpenRouter(endpoint, body) : hf.estimate(endpoint, body);
export const submit = (endpoint: string, body: Record<string, unknown>) => or.isOpenRouter(endpoint) ? or.submitOpenRouter(endpoint, body) : hf.submit(endpoint, body);
export const getStatus = (endpoint: string, id: string) => or.isOpenRouter(endpoint) ? or.statusOpenRouter(id) : hf.getStatus(id);
export async function cancel(endpoint: string, id: string): Promise<unknown> {
  if (or.isOpenRouter(endpoint)) throw new Error("OpenRouter does not document a video cancellation endpoint. This generation continues until completion.");
  return hf.cancel(id);
}
