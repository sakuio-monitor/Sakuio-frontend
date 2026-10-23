import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@sakuio/ui";
import { Copy } from "lucide-react";
import { Button } from "@sakuio/ui";
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
import { Tabs } from "../Tabs/Tabs";
import "./InstallSidebar.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 已存在节点的 agent token */
  token: string;
  name: string;
};

const PLATFORM_TABS: { id: InstallPlatform; label: string }[] = [
  { id: "linux", label: "Linux" },
  { id: "windows", label: "Windows" },
  { id: "macos", label: "macOS" },
];

/**
 * 节点行内「安装」侧栏：展示当前节点的一键安装命令，
 * 命令随平台与安装选项实时更新。
 */
export function InstallSidebar({ open, onClose, token, name }: Props) {
  const { t } = useTranslation();
  const [endpoint, setEndpoint] = useState("");
  const [platform, setPlatform] = useState<InstallPlatform>("linux");
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<InstallOptions>(DEFAULT_INSTALL_OPTIONS);

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

  const handleClose = () => {
    onClose();
    setCopied(false);
    setPlatform("linux");
    setOptions(DEFAULT_INSTALL_OPTIONS);
  };

  // 存在节点 token，命令可直接实时生成
  const installCommand = useMemo(() => {
    if (!token) return "";
    return buildInstallCommand(platform, endpoint, token, "token", options);
  }, [platform, endpoint, token, options]);

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
      title={`${t("admin.servers.install")} - ${name}`}
      onClose={handleClose}
      footer={null}
    >
      <div className="admin-sidebar-form">
        <Tabs
          items={PLATFORM_TABS.map((p) => ({ id: p.id, label: p.label }))}
          value={platform}
          onChange={(id) => setPlatform(id as typeof platform)}
          stretch
        />

        <div className="add-server-install">
          <p className="add-server-install__heading">{t("admin.servers.installOptions")}</p>
          <InstallOptionsPanel value={options} onChange={setOptions} />
        </div>

        <p className="add-server-install__heading">{t("admin.servers.installCommand")}</p>
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
      </div>
    </GenericSidebar>
  );
}
