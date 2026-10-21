import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Bolt,
  CircleArrowRight,
  Code,
  Database,
  Ellipsis,
  FileText,
  Home,
  LayoutDashboard,
  MessageCircleMore,
  Palette,
  Server,
  Settings2,
  Store,
} from "lucide-react";

export type AdminNavItem = {
  path: string;
  labelKey: string;
  icon: LucideIcon;
};

export type AdminNavGroup = {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  items: AdminNavItem[];
};

/** Admin sidebar hierarchy; paths are relative to the `/admin` basename. */
export const ADMIN_TOP_LINKS: AdminNavItem[] = [
  { path: "/dashboard", labelKey: "admin.nav.dashboard", icon: LayoutDashboard },
  { path: "/servers", labelKey: "admin.nav.serverList", icon: Server },
];

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "operations",
    labelKey: "admin.nav.operations",
    icon: Bolt,
    items: [
      { path: "/ping", labelKey: "admin.nav.ping", icon: Activity },
      { path: "/exec", labelKey: "admin.nav.exec", icon: Code },
    ],
  },
  {
    id: "notification",
    labelKey: "admin.nav.notification",
    icon: Bell,
    items: [
      {
        path: "/notification/channels",
        labelKey: "admin.nav.notificationChannels",
        icon: MessageCircleMore,
      },
      {
        path: "/notification/rules",
        labelKey: "admin.nav.notificationRules",
        icon: Settings2,
      },
    ],
  },
  {
    id: "personalization",
    labelKey: "admin.nav.personalizationMenu",
    icon: Palette,
    items: [
      { path: "/themes", labelKey: "admin.nav.themes", icon: Palette },
      { path: "/market/themes", labelKey: "admin.nav.marketThemes", icon: Store },
    ],
  },
  {
    id: "system",
    labelKey: "admin.nav.system",
    icon: Bolt,
    items: [
      { path: "/settings/site", labelKey: "admin.nav.settingsSite", icon: Home },
      { path: "/settings/general", labelKey: "admin.nav.settingsGeneral", icon: Ellipsis },
      { path: "/settings/sign-on", labelKey: "admin.nav.settingsSignOn", icon: CircleArrowRight },
      { path: "/settings/metrics", labelKey: "admin.nav.settingsMetrics", icon: Database },
      { path: "/logs", labelKey: "admin.nav.logs", icon: FileText },
      { path: "/pprof", labelKey: "admin.nav.pprof", icon: Activity },
    ],
  },
];

/** Routes with real pages (excluded from placeholder routing). */
export const ADMIN_IMPLEMENTED_PATHS = new Set<string>([
  "/dashboard",
  "/servers",
  "/ping",
  "/exec",
  "/notification/channels",
  "/notification/rules",
  "/settings/site",
  "/settings/general",
]);

export const PLACEHOLDER_PATHS: string[] = [
  ...ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.path)).filter(
    (p) => !ADMIN_IMPLEMENTED_PATHS.has(p),
  ),
].filter((p) => !ADMIN_IMPLEMENTED_PATHS.has(p));

function allItems(): AdminNavItem[] {
  return [
    ...ADMIN_TOP_LINKS,
    ...ADMIN_NAV_GROUPS.flatMap((g) => g.items),
  ];
}

export function labelKeyForPath(pathname: string): string | undefined {
  const hit = allItems().find((item) => item.path === pathname);
  return hit?.labelKey;
}

export function groupIdForPath(pathname: string): string | undefined {
  return ADMIN_NAV_GROUPS.find((group) => group.items.some((item) => item.path === pathname))?.id;
}

export function pageLabelKeyForPath(pathname: string): string {
  return labelKeyForPath(pathname) ?? "admin.nav.dashboard";
}
