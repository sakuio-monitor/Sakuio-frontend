import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@sakuio/ui";
import { Copy } from "lucide-react";
import { Button, Input } from "@sakuio/ui";
import { GenericSidebar } from "../GenericSidebar/GenericSidebar";
import { fetchSiteSettings } from "../../api/siteSettings";
import { boardWsEndpoint } from "../../utils/boardEndpoint";
import {
  buildInstallCommand,
  DEFAULT_INSTALL_OPTIONS,
  type InstallOptions,
  type InstallPlatform,
} from "../../utils/agentInstall";
import { InstallOptionsPanel } from "../InstallOptionsPanel/InstallOptionsPanel";
import "./AddServerDrawer.css";

const PLATFORM_TABS: { id: InstallPlatform; label: string }[] = [
  { id: "linux", label: "Linux" },
  { id: "windows", label: "Windows" },
  { id: "macos", label: "macOS" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** 节点创建成功后触发（刷新列表） */
  onCreated: () => void;
};

/**
 * Komari 式「添加服务器」抽屉：命令区使用全局自动发现密钥，打开即可实时展示与复制；
 * 名称填写后点击「添加」创建节点（不依赖命令区）。
 */
export function AddServerDrawer({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [adKey, setAdKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("linux");
  const [options, setOptions] = useState<InstallOptions>(DEFAULT_INSTALL_OPTIONS);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchSiteSettings()
      .then((s) => {
        if (!alive) return;
        setEndpoint(boardWsEndpoint(s.agent_connect_address));
        setAdKey(s.auto_discovery_key?.trim() ?? "");
      })
      .catch(() => {
        if (alive) setEndpoint(boardWsEndpoint(""));
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const handleClose = () => {
    onClose();
    setName("");
    setCopied(false);
    setPlatform("linux");
    setOptions(DEFAULT_INSTALL_OPTIONS);
  };

  async function createClient() {
    setCreating(true);
    try {
      const payload: { name?: string } = {};
      const trimmed = name.trim();
      if (trimmed) {
        payload.name = trimmed;
      }
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? t("common.error"));
        return;
      }
      onCreated();
      toast.success(t("admin.servers.createSuccess"));
      setName("");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setCreating(false);
    }
  }

  // 安装命令随平台与选项实时更新（自动发现密钥，不依赖节点 token）
  const installCommand = useMemo(() => {
    if (!adKey) return "";
    return buildInstallCommand(platform, endpoint, adKey, "discovery", options);
  }, [platform, adKey, endpoint, options]);

  function copyCommand() {
    if (!installCommand) return;
    navigator.clipboard
      .writeText(installCommand)
      .then(() => {
        setCopied(true);
        toast.success(t("common.copied"));
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error(t("common.error")));
  }

  return (
    <GenericSidebar
      open={open}
      title={t("admin.servers.add")}
      onClose={handleClose}
      footer={
        <Button type="button" disabled={creating} onClick={() => void createClient()}>
          {creating ? t("common.saving") : t("admin.servers.add")}
        </Button>
      }
    >
      <div className="admin-sidebar-form">
        <label className="admin-sidebar-form__label">
          {t("admin.servers.name")}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("admin.servers.namePlaceholder")}
            aria-label={t("admin.servers.name")}
            autoFocus
          />
          <p className="admin-sidebar-form__hint">{t("admin.servers.nameOptionalHint")}</p>
        </label>

        <p className="admin-sidebar-form__hint">{t("admin.servers.autoDiscoveryHint")}</p>

        <div className="admin-sidebar-tabs" role="tablist">
          {PLATFORM_TABS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={platform === p.id}
              className={`admin-sidebar-tabs__tab${platform === p.id ? " is-active" : ""}`}
              onClick={() => setPlatform(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="add-server-install">
          <p className="add-server-install__heading">{t("admin.servers.installOptions")}</p>
          <InstallOptionsPanel value={options} onChange={setOptions} />
        </div>

        <p className="add-server-install__heading">{t("admin.servers.installCommand")}</p>
        {adKey ? (
          <div className="add-server-install__command">
            <code>{installCommand}</code>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="add-server-install__copy"
              onClick={copyCommand}
              aria-label={t("common.copy")}
            >
              <Copy size={14} aria-hidden />
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
          </div>
        ) : (
          <p className="admin-sidebar-form__hint">{t("admin.servers.autoDiscoveryDisabled")}</p>
        )}
      </div>
    </GenericSidebar>
  );
}
