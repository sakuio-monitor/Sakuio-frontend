import { useEffect } from "react";

function applyFavicon(favicon?: string) {
  const href = favicon?.trim() || `${import.meta.env.BASE_URL}favicon.ico`;
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

/** Keeps every admin tab (including login/terminal) on the site's configured icon. */
export function SiteFaviconSync() {
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const response = await fetch("/api/public", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { data?: { favicon?: string } };
        if (!cancelled) applyFavicon(body.data?.favicon);
      } catch {
        if (!cancelled) applyFavicon();
      }
    };
    void sync();
    const onChange = () => void sync();
    window.addEventListener("sakuio:favicon-changed", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("sakuio:favicon-changed", onChange);
    };
  }, []);
  return null;
}
