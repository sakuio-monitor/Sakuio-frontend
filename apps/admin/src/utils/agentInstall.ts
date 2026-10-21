/**
 * Agent 一键安装命令构建（添加服务器 / 行内安装共用）。
 * Shared builder for the agent one-line install command.
 */

export const INSTALL_SCRIPT_URL =
  "https://raw.githubusercontent.com/sakuio-monitor/Sakuio-agent/main/install.sh";

export const INSTALL_PS1_URL =
  "https://raw.githubusercontent.com/sakuio-monitor/Sakuio-agent/main/install.ps1";

export const DEFAULT_INSTALL_DIR = "/opt/sakuio-agent";
export const DEFAULT_INTERVAL = "3";

export type InstallPlatform = "linux" | "macos" | "windows";

export type InstallOptions = {
  // 布尔开关
  disableRemoteControl: boolean;
  disableAutoUpdate: boolean;
  insecure: boolean;
  includeBufferMemory: boolean;
  ipFromNic: boolean;
  gpuDetail: boolean;
  // 可选文本项（enabled 开关 + 值）
  versionEnabled: boolean;
  version: string;
  proxyEnabled: boolean;
  githubProxy: string;
  dirEnabled: boolean;
  installDir: string;
  svcEnabled: boolean;
  serviceName: string;
  nicsInEnabled: boolean;
  includeNics: string;
  nicsOutEnabled: boolean;
  excludeNics: string;
  mountsEnabled: boolean;
  includeMountpoints: string;
  intervalEnabled: boolean;
  interval: string;
  dayEnabled: boolean;
  monthlyResetDay: string;
};

export const DEFAULT_INSTALL_OPTIONS: InstallOptions = {
  disableRemoteControl: false,
  disableAutoUpdate: false,
  insecure: false,
  includeBufferMemory: false,
  ipFromNic: false,
  gpuDetail: false,
  versionEnabled: false,
  version: "",
  proxyEnabled: false,
  githubProxy: "",
  dirEnabled: false,
  installDir: "",
  svcEnabled: false,
  serviceName: "",
  nicsInEnabled: false,
  includeNics: "",
  nicsOutEnabled: false,
  excludeNics: "",
  mountsEnabled: false,
  includeMountpoints: "",
  intervalEnabled: false,
  interval: "",
  dayEnabled: false,
  monthlyResetDay: "",
};

/** 组装 agent 参数（不含 -e / -t / --auto-discovery）。 */
export function buildInstallArgs(o: InstallOptions): string[] {
  const args: string[] = [];
  if (o.disableRemoteControl) args.push("--disable-remote-control");
  if (o.disableAutoUpdate) args.push("--disable-auto-update");
  if (o.insecure) args.push("--insecure");
  if (o.includeBufferMemory) args.push("--include-buffer-memory");
  if (o.ipFromNic) args.push("--ip-from-nic");
  if (o.gpuDetail) args.push("--gpu-detail");

  const pushValue = (flag: string, raw: string, fallback?: string) => {
    const v = raw.trim();
    if (!v) return;
    if (fallback !== undefined && v === fallback) return;
    args.push(flag, v);
  };

  if (o.versionEnabled) pushValue("--version", o.version);
  if (o.proxyEnabled) {
    const proxy = o.githubProxy.trim().replace(/\/+$/, "");
    if (proxy) args.push("--github-proxy", proxy);
  }
  if (o.dirEnabled) pushValue("--install-dir", o.installDir, DEFAULT_INSTALL_DIR);
  if (o.svcEnabled) pushValue("--service-name", o.serviceName, "sakuio-agent");
  if (o.nicsInEnabled) pushValue("--include-nics", o.includeNics);
  if (o.nicsOutEnabled) pushValue("--exclude-nics", o.excludeNics);
  if (o.mountsEnabled) pushValue("--include-mountpoints", o.includeMountpoints);
  if (o.intervalEnabled) pushValue("-i", o.interval, DEFAULT_INTERVAL);
  if (o.dayEnabled) pushValue("--monthly-reset-day", o.monthlyResetDay);
  return args;
}

const quoteArg = (a: string) => (/\s/.test(a) ? `"${a}"` : a);

/**
 * 生成一键安装命令。
 * @param platform 目标平台
 * @param endpoint 面板 WebSocket 地址
 * @param authValue 节点 token 或自动发现密钥
 * @param authMode 鉴权方式：节点 token / 全局自动发现密钥
 */
export function buildInstallCommand(
  platform: InstallPlatform,
  endpoint: string,
  authValue: string,
  authMode: "token" | "discovery",
  o: InstallOptions,
): string {
  const args = ["-e", endpoint, authMode === "token" ? "-t" : "--auto-discovery", authValue, ...buildInstallArgs(o)];
  const joined = args.map(quoteArg).join(" ");
  if (platform === "macos") {
    return `zsh <(curl -fsSL ${INSTALL_SCRIPT_URL}) ${joined}`;
  }
  if (platform === "windows") {
    const psArgs = args.map((a) => (/\s/.test(a) ? `\"${a}\"` : a)).join(" ");
    return `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "iwr '${INSTALL_PS1_URL}' -UseBasicParsing -OutFile 'install.ps1'; if ($?) { & '.\\install.ps1' ${psArgs} }"`;
  }
  return `curl -fsSL ${INSTALL_SCRIPT_URL} | sudo bash -s -- ${joined}`;
}
