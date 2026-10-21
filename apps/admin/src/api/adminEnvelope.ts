export type ApiEnvelope<T = unknown> = {
  status: string;
  message?: string;
  data?: T;
};

export async function readApiEnvelope<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || body.status === "error") {
    throw new Error(body.message?.trim() || "request failed");
  }
  return body.data as T;
}

export async function readApiEnvelopeVoid(res: Response): Promise<void> {
  await readApiEnvelope<null>(res);
}
