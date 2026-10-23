export type ReservedIpKind =
  | "loopback"
  | "private"
  | "linkLocal"
  | "cgnat"
  | "multicast"
  | "unspecified"
  | "reserved";

function ipv4Kind(parts: number[]): ReservedIpKind | null {
  const [a, b, c] = parts;
  if (parts.every((part) => part === 0)) return "unspecified";
  if (a === 0) return "reserved";
  if (a === 10) return "private";
  if (a === 127) return "loopback";
  if (a === 169 && b === 254) return "linkLocal";
  if (a === 172 && b >= 16 && b <= 31) return "private";
  if (a === 192 && b === 168) return "private";
  if (a === 100 && b >= 64 && b <= 127) return "cgnat";
  if (a === 198 && (b === 18 || b === 19)) return "reserved";
  if (
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    (a === 192 && b === 88 && c === 99)
  ) {
    return "reserved";
  }
  if (a >= 224 && a <= 239) return "multicast";
  if (a >= 240) return "reserved";
  return null;
}

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const number = Number(part);
    if (number < 0 || number > 255) return null;
    numbers.push(number);
  }
  return numbers;
}

/** Detects loopback/private/link-local/CGNAT and other non-public ranges. */
export function reservedIpKind(value: string): ReservedIpKind | null {
  let ip = value.trim().toLowerCase();
  if (!ip) return null;
  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
  }
  const v4 = parseIpv4(ip);
  if (v4) return ipv4Kind(v4);

  if (ip.startsWith("::ffff:")) {
    const mapped = parseIpv4(ip.slice("::ffff:".length));
    if (mapped) return ipv4Kind(mapped);
  }
  if (ip === "::" || ip === "0:0:0:0:0:0:0:0") return "unspecified";
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return "loopback";
  if (ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) {
    return "linkLocal";
  }
  if (ip.startsWith("fc") || ip.startsWith("fd")) return "private";
  if (ip.startsWith("ff")) return "multicast";
  if (ip.startsWith("2001:db8")) return "reserved";
  return null;
}
