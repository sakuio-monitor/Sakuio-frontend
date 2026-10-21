import { useTranslation } from "react-i18next";
import { Input } from "@sakuio/ui";
import { Switch } from "../ui/Switch";
import {
  DEFAULT_INSTALL_DIR,
  type InstallOptions,
} from "../../utils/agentInstall";
import "./InstallOptionsPanel.css";

type Props = {
  value: InstallOptions;
  onChange: (next: InstallOptions) => void;
};

type RowDef = {
  boolKey?: keyof InstallOptions;
  enabledKey?: keyof InstallOptions;
  valueKey?: keyof InstallOptions;
  i18n: string;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric";
};

const ROWS: RowDef[] = [
  { boolKey: "disableRemoteControl", i18n: "admin.servers.optDisableRemoteControl" },
  { boolKey: "disableAutoUpdate", i18n: "admin.servers.optDisableAutoUpdate" },
  { boolKey: "insecure", i18n: "admin.servers.optInsecure" },
  { boolKey: "includeBufferMemory", i18n: "admin.servers.optIncludeBufferMemory" },
  { boolKey: "ipFromNic", i18n: "admin.servers.optIpFromNic" },
  { boolKey: "gpuDetail", i18n: "admin.servers.optGpuDetail" },
  { enabledKey: "versionEnabled", valueKey: "version", i18n: "admin.servers.optVersion", placeholder: "0.1.0" },
  { enabledKey: "proxyEnabled", valueKey: "githubProxy", i18n: "admin.servers.optGithubProxy", placeholder: "https://ghproxy.example.com" },
  { enabledKey: "dirEnabled", valueKey: "installDir", i18n: "admin.servers.optInstallDir", placeholder: DEFAULT_INSTALL_DIR },
  { enabledKey: "svcEnabled", valueKey: "serviceName", i18n: "admin.servers.optServiceName", placeholder: "sakuio-agent" },
  { enabledKey: "nicsInEnabled", valueKey: "includeNics", i18n: "admin.servers.optIncludeNics", placeholder: "eth0, eth1" },
  { enabledKey: "nicsOutEnabled", valueKey: "excludeNics", i18n: "admin.servers.optExcludeNics", placeholder: "docker0, veth" },
  { enabledKey: "mountsEnabled", valueKey: "includeMountpoints", i18n: "admin.servers.optIncludeMountpoints", placeholder: "/, /data" },
  { enabledKey: "intervalEnabled", valueKey: "interval", i18n: "admin.servers.optInterval", placeholder: "3", inputMode: "decimal" },
  { enabledKey: "dayEnabled", valueKey: "monthlyResetDay", i18n: "admin.servers.optMonthResetDay", placeholder: "1", inputMode: "numeric" },
];

/**
 * 安装选项面板：全部选项两列均分，可选文本项启用后在其格子内展示输入框。
 * 供添加服务器抽屉与行内安装侧栏共用。
 */
export function InstallOptionsPanel({ value, onChange }: Props) {
  const { t } = useTranslation();
  const set = (patch: Partial<InstallOptions>) => onChange({ ...value, ...patch });

  return (
    <div className="install-options">
      {ROWS.map((row) => {
        const isBool = !!row.boolKey;
        const active = isBool ? Boolean(value[row.boolKey!]) : Boolean(value[row.enabledKey!]);
        return (
          <div key={row.i18n} className="install-options__cell">
            <label className="install-options__row">
              <Switch
                checked={active}
                label={t(row.i18n)}
                onChange={(v) =>
                  set(isBool ? { [row.boolKey!]: v } : { [row.enabledKey!]: v })
                }
              />
              <span>{t(row.i18n)}</span>
            </label>
            {!isBool && active && (
              <Input
                value={String(value[row.valueKey!] ?? "")}
                onChange={(e) => set({ [row.valueKey!]: e.target.value } as Partial<InstallOptions>)}
                placeholder={row.placeholder}
                inputMode={row.inputMode ?? "text"}
                aria-label={t(row.i18n)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
