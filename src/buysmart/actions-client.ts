import { getAuthToken } from "deepspace";
import { z } from "zod";
const resultSchema = z.object({ success: z.boolean().optional(), data: z.unknown().optional(), error: z.string().optional() });
export async function actionHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${await getAuthToken()}` };
}
export async function callAction<T>(name: string, params: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/actions/${name}`, {
    method: "POST", headers: await actionHeaders(),
    body: JSON.stringify(params), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(130_000)]) : AbortSignal.timeout(130_000),
  });
  const result = resultSchema.parse(await response.json());
  if (!response.ok || !result.success) throw new Error(result.error ?? "Request unavailable. Please retry deliberately.");
  return result.data as T;
}
