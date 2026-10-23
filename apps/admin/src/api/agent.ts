export async function fetchAgentVersion(): Promise<string> {
  const response = await fetch("/api/admin/agents/version", { cache: "no-store" });
  if (!response.ok) throw new Error("获取 Agent 版本失败");
  const body = (await response.json()) as { version?: string };
  return body.version ?? "";
}

export async function triggerAgentUpdate(uuid: string): Promise<void> {
  const response = await fetch(`/api/admin/clients/${encodeURIComponent(uuid)}/update-agent`, {
    method: "POST",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "下发更新指令失败");
  }
}
