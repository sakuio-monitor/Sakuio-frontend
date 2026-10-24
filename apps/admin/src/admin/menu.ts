import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Bolt,
  Boxes,
  CircleArrowRight,
  Code,
  Database,
  Ellipsis,
  FileText,
  Globe2,
  Home,
  KeyRound,
  LayoutDashboard,
  MessageCircleMore,
  Palette,
  Server,
  Settings2,
  SquareTerminal,
  Store,
  UserRound,
} from "lucide-react";

export type AdminNavItem = {
  path: string;
  labelKey: string;
  icon: LucideIcon;
  /** Dynamic label used by injected theme settings entries. */
  rawLabel?: string;
  /** Open outside the SPA (workbench is a standalone tab). */
  newTab?: boolean;
};

export type AdminNavGroup = {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  items: AdminNavItem[];
};

/** Admin sidebar hierarchy; paths are relative to the `/admin` basename. */
export const ADMIN_TOP_LINKS: AdminNavItem[] = [];

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "dashboard",
    labelKey: "admin.nav.dashboard",
    icon: LayoutDashboard,
    items: [
      { path: "/dashboard", labelKey: "admin.nav.dashboard", icon: LayoutDashboard },
      { path: "/workbench", labelKey: "admin.nav.workbench", icon: SquareTerminal, newTab: true },
    ],
  },
  {
    id: "assets",
    labelKey: "admin.nav.assets",
    icon: Boxes,
    items: [
      { path: "/servers", labelKey: "admin.nav.serverList", icon: Server },
      { path: "/assets/auth", labelKey: "admin.nav.authApi", icon: KeyRound },
    ],
  },
  {
    id: "operations",
    labelKey: "admin.nav.operations",
    icon: Bolt,
    items: [
      { path: "/ping", labelKey: "admin.nav.ping", icon: Activity },
      { path: "/exec", labelKey: "admin.nav.exec", icon: Code },
      { path: "/ddns", labelKey: "admin.nav.ddns", icon: Globe2 },
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
      { path: "/settings/account", labelKey: "admin.nav.account", icon: UserRound },
      { path: "/settings/site", labelKey: "admin.nav.settingsSite", icon: Home },
      { path: "/settings/general", labelKey: "admin.nav.settingsGeneral", icon: Ellipsis },
      { path: "/settings/sign-on", labelKey: "admin.nav.settingsSignOn", icon: CircleArrowRight },
      { path: "/settings/database", labelKey: "admin.nav.settingsDatabase", icon: Database },
      { path: "/logs", labelKey: "admin.nav.logs", icon: FileText },
      { path: "/pprof", labelKey: "admin.nav.pprof", icon: Activity },
    ],
  },
];

/** Routes with real pages (excluded from placeholder routing). */
export const ADMIN_IMPLEMENTED_PATHS = new Set<string>([
  "/dashboard",
  "/workbench",
  "/servers",
  "/assets/auth",
  "/ping",
  "/ddns",
  "/exec",
  "/notification/channels",
  "/notification/rules",
  "/settings/account",
  "/settings/site",
  "/settings/general",
  "/settings/database",
  "/logs",
  "/pprof",
  "/themes",
  "/market/themes",
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
  if (/^\/themes\/[^/]+\/settings$/.test(pathname)) return "admin.nav.themeSettings";
  const hit = allItems().find((item) => item.path === pathname);
  return hit?.labelKey;
}

export function groupIdForPath(pathname: string): string | undefined {
  if (/^\/themes\/[^/]+\/settings$/.test(pathname)) return "personalization";
  return ADMIN_NAV_GROUPS.find((group) => group.items.some((item) => item.path === pathname))?.id;
}

export function pageLabelKeyForPath(pathname: string): string {
  return labelKeyForPath(pathname) ?? "admin.nav.dashboard";
}
