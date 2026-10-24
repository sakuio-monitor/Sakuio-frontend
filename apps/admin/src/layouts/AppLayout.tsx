import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronLeft, ChevronRight, Languages, LogOut, Menu, Monitor, Moon, Palette, Sun, X } from "lucide-react";
import {
  ADMIN_NAV_GROUPS,
  ADMIN_TOP_LINKS,
  groupIdForPath,
  pageLabelKeyForPath,
  type AdminNavItem,
} from "../admin/menu";
import { changeLocale, type SupportedLocale } from "@sakuio/i18n";
import { fetchThemes } from "../api/themes";
import { CellTooltip } from "../components/CellTooltip/CellTooltip";
import { PageTitleContext } from "../contexts/PageTitleContext";
import { useAuth } from "../auth/AuthProvider";
import { applyThemeTransition, type ThemeTransitionOrigin } from "../utils/themeTransition";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import "../styles/ambient.css";
import "../styles/admin-tokens.css";
import "./AppLayout.css";

const MOBILE_MQ = "(max-width: 800px)";

function localized(value: unknown, language: string): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const map = value as Record<string, unknown>;
  for (const key of [language, "zh-CN", "en", "ja"]) {
    const text = map[key];
    if (typeof text === "string" && text.trim()) return text;
  }
  return Object.values(map).find((text): text is string => typeof text === "string" && !!text.trim()) ?? "";
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_MQ).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

function useSystemPrefersDark() {
  const [prefers, setPrefers] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setPrefers(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return prefers;
}

/** Theme cycle: light -> dark -> system. | 主题循环：浅色 → 深色 → 跟随系统。 */
export type ThemeMode = "light" | "dark" | "system";
const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];
const THEME_STORAGE_KEY = "sakuio-admin-theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && (THEME_MODES as string[]).includes(value);
}

function resolveDark(mode: ThemeMode): boolean {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return mode === "dark";
}

function applyModeClass(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", resolveDark(mode));
}

function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeMode(stored)) return stored;
    } catch {
      /* ignore */
    }
    return "light";
  });
  const systemDark = useSystemPrefersDark();

  const dark = mode === "system" ? systemDark : mode === "dark";

  useEffect(() => {
    applyModeClass(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  // 跟随系统时监听系统深浅色变化。
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyModeClass("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  function cycleMode(origin?: ThemeTransitionOrigin) {
    const next = THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];
    applyThemeTransition(() => {
      applyModeClass(next);
      flushSync(() => setMode(next));
    }, origin);
  }

  return { dark, mode, cycleMode };
}

function InternalNavLink({
  item,
  label,
  variant,
  onNavigate,
}: {
  item: AdminNavItem;
  label: string;
  variant: "top" | "sub";
  onNavigate?: () => void;
}) {
  const ItemIcon = item.icon;
  if (item.newTab) {
    const href = `${import.meta.env.BASE_URL}${item.path.replace(/^\//, "")}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={variant === "top" ? "menu-item menu-item-top" : "nav-sub-item menu-item"}
        onClick={onNavigate}
      >
        <ItemIcon size={20} className="menu-item-icon" />
        <span className="menu-item-label">{label}</span>
      </a>
    );
  }
  return (
    <NavLink
      to={item.path}
      end
      className={({ isActive }) =>
        variant === "top"
          ? `menu-item menu-item-top ${isActive ? "active" : ""}`
          : `nav-sub-item menu-item ${isActive ? "active" : ""}`
      }
      onClick={onNavigate}
    >
      <ItemIcon size={20} className="menu-item-icon" />
      <span className="menu-item-label">{label}</span>
    </NavLink>
  );
}

function NavEntryLink({
  item,
  label,
  variant,
  onNavigate,
}: {
  item: AdminNavItem;
  label: string;
  variant: "top" | "sub";
  onNavigate?: () => void;
}) {
  return <InternalNavLink item={item} label={label} variant={variant} onNavigate={onNavigate} />;
}

/** Topbar theme toggle: light -> dark -> system. | 顶栏主题循环切换。 */
function ThemeToggleButton({
  mode,
  onCycle,
}: {
  mode: ThemeMode;
  onCycle: (origin?: ThemeTransitionOrigin) => void;
}) {
  const { t } = useTranslation();
  const labelKey =
    mode === "light"
      ? "admin.nav.themeLight"
      : mode === "dark"
        ? "admin.nav.themeDark"
        : "admin.nav.themeSystem";
  return (
    <CellTooltip tip={t(labelKey)}>
      <button
        type="button"
        className="topbar-action-btn"
        onClick={(event) => onCycle({ x: event.clientX, y: event.clientY })}
        aria-label={t(labelKey)}
      >
        {mode === "light" ? <Sun size={18} /> : mode === "dark" ? <Moon size={18} /> : <Monitor size={18} />}
      </button>
    </CellTooltip>
  );
}

/** Topbar language menu (zh-CN / en). | 顶栏语言切换菜单。 */
function LanguageToggleButton({ dark }: { dark: boolean }) {
  const { i18n, t } = useTranslation();
  return (
    <CellTooltip tip={t("common.language")}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="topbar-action-btn" aria-label={t("common.language")}>
            <Languages size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-32" themeAppearance={dark ? "dark" : "light"}>
          <DropdownMenuItem onSelect={() => void changeLocale(i18n, "zh-CN")}>简体中文</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void changeLocale(i18n, "en")}>English</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </CellTooltip>
  );
}

function LogoutButton({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation();
  return (
    <CellTooltip tip={t("common.logout")}>
      <button
        type="button"
        className="topbar-action-btn"
        onClick={onLogout}
        aria-label={t("common.logout")}
      >
        <LogOut size={18} />
      </button>
    </CellTooltip>
  );
}

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState<string | undefined>();
  const [themeSettingsItem, setThemeSettingsItem] = useState<AdminNavItem | null>(null);
  // 主题状态上提：顶栏按钮与语言下拉共用；语言菜单跟随页面主题。
  const { dark, mode, cycleMode } = useThemeMode();

  const currentPageLabel = useMemo(
    () => pageTitle ?? t(pageLabelKeyForPath(location.pathname)),
    [location.pathname, pageTitle, t],
  );

  useEffect(() => {
    let ignore = false;
    const load = () => {
      void fetchThemes()
        .then(({ themes }) => {
          if (ignore) return;
          const match = location.pathname.match(/^\/themes\/([^/]+)\/settings$/);
          let settingsShort = "";
          if (match) {
            try {
              settingsShort = decodeURIComponent(match[1]);
            } catch {
              settingsShort = match[1];
            }
          }
          const target =
            themes.find((theme) => settingsShort && theme.short === settingsShort) ??
            themes.find((theme) => theme.active);
          if (!target || target.config_items <= 0) {
            setThemeSettingsItem(null);
            return;
          }
          const language = i18n.resolvedLanguage || i18n.language || "en";
          const label =
            localized(target.configuration_name, language) ||
            t("admin.themes.manageWithName", { name: target.name || target.short });
          setThemeSettingsItem({
            path: `/themes/${encodeURIComponent(target.short)}/settings`,
            labelKey: "admin.nav.themeSettings",
            rawLabel: label,
            icon: Palette,
          });
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener("sakuio:themes-changed", load);
    return () => {
      ignore = true;
      window.removeEventListener("sakuio:themes-changed", load);
    };
  }, [i18n.language, i18n.resolvedLanguage, location.pathname, t]);

  // 收起时鼠标悬停自动展开；移出恢复收起。
  const visuallyCollapsed = collapsed && !hoverExpanded;

  useEffect(() => {
    const activeId = groupIdForPath(location.pathname);
    if (activeId) {
      setExpanded((current) => ({ ...current, [activeId]: true }));
    }
  }, [location.pathname]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    document.title = `${currentPageLabel} - Sakuio`;
  }, [currentPageLabel]);

  function toggleGroup(groupId: string) {
    setExpanded((current) => ({ ...current, [groupId]: !current[groupId] }));
  }

  function renderNav(opts: { collapsedMode: boolean; onNavigate?: () => void }) {
    const { collapsedMode, onNavigate } = opts;
    return (
      <>
        <ul className="menu-list menu-list-top">
          {ADMIN_TOP_LINKS.map((item) => (
            <li key={item.path}>
              <NavEntryLink item={item} label={t(item.labelKey)} variant="top" onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        {ADMIN_NAV_GROUPS.map((group) => {
          const items =
            group.id === "personalization" && themeSettingsItem
              ? [...group.items, themeSettingsItem]
              : group.items;
          const Icon = group.icon;
          const isOpen = collapsedMode ? false : Boolean(expanded[group.id]);
          // 收起态下组按钮只剩图标，用通用 tooltip 提示组名
          const trigger = (
            <button
              type="button"
              className="nav-group-trigger menu-item"
              aria-expanded={isOpen}
              aria-label={t(group.labelKey)}
              onClick={() => toggleGroup(group.id)}
            >
              <Icon size={20} className="menu-item-icon" />
              {!collapsedMode && (
                <>
                  <span className="menu-item-label">{t(group.labelKey)}</span>
                  <ChevronDown
                    size={18}
                    className={`nav-group-chevron ${isOpen ? "is-open" : ""}`}
                    aria-hidden
                  />
                </>
              )}
            </button>
          );
          return (
            <div key={group.id} className={`nav-group ${isOpen ? "is-open" : ""}`}>
              {collapsedMode ? (
                <CellTooltip tip={t(group.labelKey)}>{trigger}</CellTooltip>
              ) : (
                trigger
              )}
              {!collapsedMode && (
                <div className={`nav-sub-wrap ${isOpen ? "is-open" : ""}`}>
                  <div className="nav-sub-inner">
                    <ul className="nav-sub-list">
                      {items.map((item) => (
                        <li key={item.path}>
                          <NavEntryLink
                            item={item}
                            label={item.rawLabel ?? t(item.labelKey)}
                            variant="sub"
                            onNavigate={onNavigate}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div className="sidebar-spacer" />
      </>
    );
  }

  return (
    <div
      className={`app-shell ambient-surface ${isMobile ? "app-shell--mobile" : ""} ${mobileMenuOpen ? "app-shell--menu-open" : ""}`}
    >
      <aside
        className={`sidebar-container sidebar-container--desktop ${visuallyCollapsed ? "collapsed" : "expanded"}`}
        onMouseEnter={() => {
          if (collapsed) setHoverExpanded(true);
        }}
        onMouseLeave={() => setHoverExpanded(false)}
      >
        <div className={`sidebar-header ${visuallyCollapsed ? "collapsed-header" : ""}`}>
          {!visuallyCollapsed && <div className="sidebar-logo-text">Sakuio</div>}
          <CellTooltip tip={collapsed ? t("admin.nav.expandMenu") : t("admin.nav.collapseMenu")}>
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={() => {
                setCollapsed((value) => !value);
                setHoverExpanded(false);
              }}
              aria-label={collapsed ? t("admin.nav.expandMenu") : t("admin.nav.collapseMenu")}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </CellTooltip>
        </div>
        <nav className="sidebar-nav" aria-label={t("admin.title")}>
          {renderNav({ collapsedMode: visuallyCollapsed })}
        </nav>
      </aside>

      <div
        className={`mobile-nav-backdrop ${mobileMenuOpen ? "is-open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden={!mobileMenuOpen}
      />
      <aside
        className={`mobile-nav-drawer ${mobileMenuOpen ? "is-open" : ""}`}
        aria-hidden={!mobileMenuOpen}
        aria-label={t("admin.title")}
      >
        <div className="sidebar-header">
          <div className="sidebar-logo-text">Sakuio</div>
          <CellTooltip tip={t("admin.nav.collapseMenu")}>
            <button
              type="button"
              className="mobile-nav-drawer__close"
              onClick={() => setMobileMenuOpen(false)}
              aria-label={t("admin.nav.collapseMenu")}
            >
              <X size={22} />
            </button>
          </CellTooltip>
        </div>
        <nav className="sidebar-nav">{renderNav({ collapsedMode: false, onNavigate: () => setMobileMenuOpen(false) })}</nav>
      </aside>

      <main className="app-main">
        {isMobile ? (
          <header className="mobile-topbar">
            <h1 className="mobile-topbar__title">{currentPageLabel}</h1>
            <div className="mobile-topbar__actions">
              <ThemeToggleButton mode={mode} onCycle={cycleMode} />
              <LanguageToggleButton dark={dark} />
              <LogoutButton onLogout={() => void logout().then(() => navigate("/login", { replace: true }))} />
              <CellTooltip tip={mobileMenuOpen ? t("admin.nav.collapseMenu") : t("admin.nav.expandMenu")}>
                <button
                  type="button"
                  className="mobile-topbar__menu"
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  aria-label={mobileMenuOpen ? t("admin.nav.collapseMenu") : t("admin.nav.expandMenu")}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
              </CellTooltip>
            </div>
          </header>
        ) : (
          <header className="app-topbar">
            <span className="app-topbar__page">{currentPageLabel}</span>
            <div className="app-topbar__actions">
              <ThemeToggleButton mode={mode} onCycle={cycleMode} />
              <LanguageToggleButton dark={dark} />
              <LogoutButton onLogout={() => void logout().then(() => navigate("/login", { replace: true }))} />
            </div>
          </header>
        )}
        <div className="app-content" ref={contentRef}>
          <PageTitleContext.Provider value={setPageTitle}>
            <Outlet />
          </PageTitleContext.Provider>
        </div>
      </main>
    </div>
  );
}
