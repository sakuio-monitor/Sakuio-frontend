// Agent 端 `-e` 只接收 `ws(s)://host[:port]`；link / relay 路径由 agent 内部拼接。
// 兼容站点设置里遗留的完整 URL（带 http(s) 前缀或带路径），统一归一化成 base。
export function boardWsEndpoint(agentAddress: string): string {
  const trimmed = agentAddress.trim().replace(/\/+$/, "");
  if (trimmed) {
    const httpMatch = trimmed.match(/^https?:\/\/([^/?#]+)/i);
    if (httpMatch) {
      const scheme = /^https/i.test(trimmed) ? "wss" : "ws";
      return `${scheme}://${httpMatch[1]}`;
    }
    const wsMatch = trimmed.match(/^(wss?):\/\/([^/?#]+)/i);
    if (wsMatch) {
      return `${wsMatch[1].toLowerCase()}://${wsMatch[2]}`;
    }
    return trimmed;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
}
