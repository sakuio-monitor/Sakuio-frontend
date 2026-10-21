import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@sakuio/ui";
import { Copy, ChevronDown } from "lucide-react";
import { Button, Input } from "@sakuio/ui";
import { GenericSidebar } from "../GenericSidebar/GenericSidebar";
import { Switch } from "../ui/Switch";
import { fetchSiteSettings } from "../../api/siteSettings";
import { boardWsEndpoint } from "../../utils/boardEndpoint";
import "./AddServerDrawer.css";

const INSTALL_SCRIPT_URL =
  "https://raw.githubusercontent.com/sakuio-monitor/Sakuio-agent/main/install.sh";

type BoolOptKey =
  | "disableRemoteControl"
  | "disableAutoUpdate"
  | "insecure"
  | "includeBufferMemory"
  | "ipFromNic"
  | "gpuDetail";

const BOOL_OPTS: { key: BoolOptKey; flag: string; i18n: string }[] = [
  { key: "disableRemoteControl", flag: "--disable-remote-control", i18n: "admin.servers.optDisableRemoteControl" },
  { key: "disableAutoUpdate", flag: "--disable-auto-update", i18n: "admin.servers.optDisableAutoUpdate" },
  { key: "insecure", flag: "--insecure", i18n: "admin.servers.optInsecure" },
  { key: "includeBufferMemory", flag: "--include-buffer-memory", i18n: "admin.servers.optIncludeBufferMemory" },
  { key: "ipFromNic", flag: "--ip-from-nic", i18n: "admin.servers.optIpFromNic" },
  { key: "gpuDetail", flag: "--gpu-detail", i18n: "admin.servers.optGpuDetail" },
];

const DEFAULT_INSTALL_DIR = "/opt/sakuio-agent";
const DEFAULT_INTERVAL = "3";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 节点创建成功后触发（刷新列表） */
  onCreated: () => void;
};

/**
 * Komari 式「添加服务器」抽屉：名称、安装选项与一键安装命令同屏展示，
 * 点击「添加」时创建节点，安装选项的每次改动实时反映到命令。
 */
export function AddServerDrawer({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [client, setClient] = useState<{ token: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [copied, setCopied] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // 布尔开关
  const [boolOpts, setBoolOpts] = useState<Record<BoolOptKey, boolean>>({
    disableRemoteControl: false,
    disableAutoUpdate: false,
    insecure: false,
    includeBufferMemory: false,
    ipFromNic: false,
    gpuDetail: false,
  });
  // 文本选项
  const [version, setVersion] = useState("");
  const [githubProxy, setGithubProxy] = useState("");
  const [installDir, setInstallDir] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [includeNics, setIncludeNics] = useState("");
  const [excludeNics, setExcludeNics] = useState("");
  const [includeMountpoints, setIncludeMountpoints] = useState("");
  const [interval, setInterval] = useState(DEFAULT_INTERVAL);
  const [monthlyResetDay, setMonthlyResetDay] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchSiteSettings()
      .then((s) => {
        if (alive) setEndpoint(boardWsEndpoint(s.agent_connect_address));
      })
      .catch(() => {
        if (alive) setEndpoint(boardWsEndpoint(""));
      });
    return () => {
      alive = false;
    };
  }, [open]);

  function reset() {
    setClient(null);
    setName("");
    setCopied(false);
    setAdvancedOpen(false);
    setBoolOpts({
      disableRemoteControl: false,
      disableAutoUpdate: false,
      insecure: false,
      includeBufferMemory: false,
      ipFromNic: false,
      gpuDetail: false,
    });
    setVersion("");
    setGithubProxy("");
    setInstallDir("");
    setServiceName("");
    setIncludeNics("");
    setExcludeNics("");
    setIncludeMountpoints("");
    setInterval(DEFAULT_INTERVAL);
    setMonthlyResetDay("");
  }

  const handleClose = () => {
    onClose();
    reset();
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
      const data = (await res.json()) as { token?: string; message?: string };
      if (!res.ok || !data.token) {
        toast.error(data.message ?? t("common.error"));
        return;
      }
      setClient({ token: data.token });
      onCreated();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setCreating(false);
    }
  }

  // 安装命令随选项实时更新
  const installCommand = useMemo(() => {
    if (!client) return "";
    const args: string[] = ["-e", endpoint, "-t", client.token];
    for (const opt of BOOL_OPTS) {
      if (boolOpts[opt.key]) args.push(opt.flag);
    }
    const v = version.trim();
    if (v) args.push("--version", v);
    const proxy = githubProxy.trim().replace(/\/+$/, "");
    if (proxy) args.push("--github-proxy", proxy);
    const dir = installDir.trim();
    if (dir && dir !== DEFAULT_INSTALL_DIR) args.push("--install-dir", dir);
    const svc = serviceName.trim();
    if (svc && svc !== "sakuio-agent") args.push("--service-name", svc);
    const nicsIn = includeNics.trim();
    if (nicsIn) args.push("--include-nics", nicsIn);
    const nicsOut = excludeNics.trim();
    if (nicsOut) args.push("--exclude-nics", nicsOut);
    const mounts = includeMountpoints.trim();
    if (mounts) args.push("--include-mountpoints", mounts);
    const ivl = interval.trim();
    if (ivl && ivl !== DEFAULT_INTERVAL) args.push("-i", ivl);
    const day = monthlyResetDay.trim();
    if (day) args.push("--monthly-reset-day", day);
    return `curl -fsSL ${INSTALL_SCRIPT_URL} | sudo bash -s -- ${args
      .map((a) => (/\s/.test(a) ? `"${a}"` : a))
      .join(" ")}`;
  }, [client, endpoint, boolOpts, version, githubProxy, installDir, serviceName, includeNics, excludeNics, includeMountpoints, interval, monthlyResetDay]);

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
        client ? undefined : (
          <Button type="button" disabled={creating} onClick={() => void createClient()}>
            {creating ? t("common.saving") : t("admin.servers.add")}
          </Button>
        )
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
            disabled={!!client}
            autoFocus
          />
          <p className="admin-sidebar-form__hint">{t("admin.servers.nameOptionalHint")}</p>
        </label>

        <div className="add-server-install">
          <p className="add-server-install__heading">{t("admin.servers.installOptions")}</p>
          <div className="add-server-install__switches">
            {BOOL_OPTS.map((opt) => (
              <label key={opt.key} className="add-server-install__switch-row">
                <Switch
                  checked={boolOpts[opt.key]}
                  label={t(opt.i18n)}
                  onChange={(v) => setBoolOpts((prev) => ({ ...prev, [opt.key]: v }))}
                />
                <span>{t(opt.i18n)}</span>
              </label>
            ))}
          </div>

          <button
            type="button"
            className="add-server-install__advanced-toggle"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <ChevronDown size={14} aria-hidden className={advancedOpen ? "rot-180" : undefined} />
            <span>{t("admin.servers.advancedOptions")}</span>
          </button>

          {advancedOpen && (
            <>
              <label className="admin-sidebar-form__label">
                {t("admin.servers.optVersion")}
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="0.1.0"
                  aria-label={t("admin.servers.optVersion")}
                />
              </label>
              <label className="admin-sidebar-form__label">
                {t("admin.servers.optGithubProxy")}
                <Input
                  value={githubProxy}
                  onChange={(e) => setGithubProxy(e.target.value)}
                  placeholder="https://ghproxy.example.com"
                  aria-label={t("admin.servers.optGithubProxy")}
                />
              </label>
              <label className="admin-sidebar-form__label">
                {t("admin.servers.optInstallDir")}
                <Input
                  value={installDir}
                  onChange={(e) => setInstallDir(e.target.value)}
                  placeholder={DEFAULT_INSTALL_DIR}
                  aria-label={t("admin.servers.optInstallDir")}
                />
              </label>
              <label className="admin-sidebar-form__label">
                {t("admin.servers.optServiceName")}
                <Input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="sakuio-agent"
                  aria-label={t("admin.servers.optServiceName")}
                />
              </label>
              <label className="admin-sidebar-form__label">
                {t("admin.servers.optIncludeNics")}
                <Input
                  value={includeNics}
                  onChange={(e) => setIncludeNics(e.target.value)}
                  placeholder="eth0, eth1"
                  aria-label={t("admin.servers.optIncludeNics")}
                />
              </label>
              <label className="admin-sidebar-form__label">
                {t("admin.servers.optExcludeNics")}
                <Input
                  value={excludeNics}
                  onChange={(e) => setExcludeNics(e.target.value)}
                  placeholder="docker0, veth"
                  aria-label={t("admin.servers.optExcludeNics")}
                />
              </label>
              <label className="admin-sidebar-form__label">
                {t("admin.servers.optIncludeMountpoints")}
                <Input
                  value={includeMountpoints}
                  onChange={(e) => setIncludeMountpoints(e.target.value)}
                  placeholder="/, /data"
                  aria-label={t("admin.servers.optIncludeMountpoints")}
                />
              </label>
              <div className="add-server-install__two-col">
                <label className="admin-sidebar-form__label">
                  {t("admin.servers.optInterval")}
                  <Input
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    inputMode="decimal"
                    aria-label={t("admin.servers.optInterval")}
                  />
                </label>
                <label className="admin-sidebar-form__label">
                  {t("admin.servers.optMonthResetDay")}
                  <Input
                    value={monthlyResetDay}
                    onChange={(e) => setMonthlyResetDay(e.target.value)}
                    inputMode="numeric"
                    placeholder="1"
                    aria-label={t("admin.servers.optMonthResetDay")}
                  />
                </label>
              </div>
            </>
          )}
        </div>

        <p className="add-server-install__heading">{t("admin.servers.installCommand")}</p>
        <div className="add-server-install__command">
          {client ? (
            <>
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
            </>
          ) : (
            <p className="admin-sidebar-form__hint">{t("admin.servers.commandPendingHint")}</p>
          )}
        </div>
      </div>
    </GenericSidebar>
  );
}
