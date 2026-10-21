/** IPv6 middle ellipsis for narrow table cells. */
export function formatIpv6Display(ipv6: string): string {
  if (ipv6.length <= 20) {
    return ipv6;
  }
  const segments = ipv6.split(":");
  if (segments.length > 3) {
    return `${segments.slice(0, 2).join(":")}:...${segments[segments.length - 1]}`;
  }
  return ipv6;
}
