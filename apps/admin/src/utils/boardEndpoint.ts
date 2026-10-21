export function boardWsEndpoint(agentAddress: string): string {
  const trimmed = agentAddress.trim().replace(/\/+$/, "");
  if (trimmed) {
    return `${trimmed.replace(/^http/, "ws")}/api/agent/link`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/agent/link`;
}
