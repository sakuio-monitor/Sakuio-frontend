import { adminFetch } from "./adminFetch";

export type AuditLogRow = {
  id: number;
  created_at: string;
  actor: string;
  actor_id: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
  user_agent: string;
  status: number;
  method: string;
  path: string;
  geo_country_code: string;
  geo_location: string;
};

export type AuditLogFilters = {
  actor: string;
  category: string;
  ip: string;
  q: string;
};

export const AUDIT_CATEGORIES = [
  "auth",
  "server",
  "terminal",
  "theme",
  "settings",
  "database",
  "notification",
  "ping",
] as const;

const ACTION_LABELS: Record<string, { zh: string; en: string }> = {
  LOGIN: { zh: "登录", en: "Login" },
  LOGIN_FAILED: { zh: "登录失败", en: "Login failed" },
  LOGIN_CHALLENGE: { zh: "登录二次验证", en: "Login 2FA challenge" },
  LOGOUT: { zh: "退出登录", en: "Logout" },
  INSTALL: { zh: "系统安装", en: "Install" },
  INSTALL_FAILED: { zh: "安装失败", en: "Install failed" },
  SERVER_ONLINE: { zh: "服务器上线", en: "Server online" },
  SERVER_OFFLINE: { zh: "服务器离线", en: "Server offline" },
  SERVER_CREATE: { zh: "添加服务器", en: "Server created" },
  SERVER_UPDATE: { zh: "修改服务器", en: "Server updated" },
  SERVER_DELETE: { zh: "删除服务器", en: "Server deleted" },
  SERVER_BATCH_DELETE: { zh: "批量删除服务器", en: "Servers batch deleted" },
  SERVER_SYNC: { zh: "同步服务器", en: "Servers synced" },
  SERVER_REORDER: { zh: "服务器排序", en: "Server reordered" },
  SERVER_GROUP_UPDATE: { zh: "修改服务器分组", en: "Server group updated" },
  SERVER_TRAFFIC_RESET: { zh: "重置服务器流量", en: "Server traffic reset" },
  WEB_TERMINAL_OPEN: { zh: "打开 Web 终端", en: "Web terminal opened" },
  WEB_TERMINAL_CLOSE: { zh: "关闭 Web 终端", en: "Web terminal closed" },
  COMMAND_EXEC: { zh: "执行远程命令", en: "Remote command executed" },
  FILE_UPLOAD: { zh: "上传文件", en: "File uploaded" },
  FILE_DOWNLOAD: { zh: "下载文件", en: "File downloaded" },
  FILE_READ: { zh: "读取文件", en: "File read" },
  FILE_EDIT: { zh: "编辑文件", en: "File edited" },
  FILE_DELETE: { zh: "删除文件", en: "File deleted" },
  FILE_MKDIR: { zh: "创建目录", en: "Directory created" },
  FILE_MOVE: { zh: "移动文件", en: "File moved" },
  FILE_RENAME: { zh: "重命名文件", en: "File renamed" },
  FILE_CHMOD: { zh: "修改文件权限", en: "File permissions changed" },
  FILE_SEARCH: { zh: "搜索文件", en: "File search" },
  FILE_LIST: { zh: "浏览文件", en: "Files browsed" },
  FILE_TRASH_RESTORE: { zh: "恢复回收站文件", en: "Trash restored" },
  FILE_TRASH_EMPTY: { zh: "清空回收站", en: "Trash emptied" },
  FILE_TRASH_DELETE: { zh: "彻底删除文件", en: "Trash deleted" },
  FILE_OPERATION: { zh: "文件操作", en: "File operation" },
  THEME_UPLOAD: { zh: "上传主题", en: "Theme uploaded" },
  THEME_INSTALL: { zh: "安装主题", en: "Theme installed" },
  THEME_UPDATE: { zh: "更新主题", en: "Theme updated" },
  THEME_APPLY: { zh: "切换主题", en: "Theme applied" },
  THEME_DELETE: { zh: "删除主题", en: "Theme deleted" },
  THEME_CONFIG_UPDATE: { zh: "修改主题配置", en: "Theme settings updated" },
  THEME_OPERATION: { zh: "主题操作", en: "Theme operation" },
  SITE_SETTINGS_UPDATE: { zh: "修改站点设置", en: "Site settings updated" },
  SHARE_TOKEN_REGENERATE: { zh: "重置分享令牌", en: "Share token regenerated" },
  GEOIP_UPDATE: { zh: "更新 GeoIP 数据库", en: "GeoIP database updated" },
  GEOIP_TEST: { zh: "测试 GeoIP", en: "GeoIP tested" },
  BACKUP_DOWNLOAD: { zh: "下载备份", en: "Backup downloaded" },
  BACKUP_RESTORE: { zh: "恢复备份", en: "Backup restored" },
  DATABASE_SWITCH: { zh: "切换主数据库", en: "Main database switched" },
  DATABASE_MIGRATE: { zh: "迁移监控数据库", en: "Metric database migrated" },
  DATABASE_UPDATE: { zh: "修改数据库配置", en: "Database settings updated" },
  DATABASE_OPERATION: { zh: "数据库操作", en: "Database operation" },
  DATABASE_VIEW: { zh: "查看数据库信息", en: "Database information viewed" },
  NOTIFICATION_CHANNEL_CREATE: { zh: "添加通知渠道", en: "Notification channel created" },
  NOTIFICATION_CHANNEL_UPDATE: { zh: "修改通知渠道", en: "Notification channel updated" },
  NOTIFICATION_CHANNEL_DELETE: { zh: "删除通知渠道", en: "Notification channel deleted" },
  NOTIFICATION_CHANNEL_TEST: { zh: "测试通知渠道", en: "Notification channel tested" },
  NOTIFICATION_RULE_CREATE: { zh: "添加通知规则", en: "Notification rule created" },
  NOTIFICATION_RULE_UPDATE: { zh: "修改通知规则", en: "Notification rule updated" },
  NOTIFICATION_RULE_DELETE: { zh: "删除通知规则", en: "Notification rule deleted" },
  NOTIFICATION_OPERATION: { zh: "通知操作", en: "Notification operation" },
  PING_TASK_CREATE: { zh: "添加 Ping 任务", en: "Ping task created" },
  PING_TASK_UPDATE: { zh: "修改 Ping 任务", en: "Ping task updated" },
  PING_TASK_DELETE: { zh: "删除 Ping 任务", en: "Ping task deleted" },
  PING_TASK_REORDER: { zh: "Ping 任务排序", en: "Ping task reordered" },
  TWO_FACTOR_SETUP: { zh: "配置两步验证", en: "2FA configured" },
  TWO_FACTOR_ENABLE: { zh: "启用两步验证", en: "2FA enabled" },
  TWO_FACTOR_DISABLE: { zh: "关闭两步验证", en: "2FA disabled" },
  ADMIN_OPERATION: { zh: "其他管理操作", en: "Other admin operation" },
};

export function auditActionLabel(action: string, language: string): string {
  const labels = ACTION_LABELS[action];
  if (!labels) return language.toLowerCase().startsWith("zh") ? "其他操作" : "Other action";
  return language.toLowerCase().startsWith("zh") ? labels.zh : labels.en;
}

export async function fetchAuditLogs(params: {
  cursor?: string;
  limit: number;
  filters: AuditLogFilters;
}): Promise<{ items: AuditLogRow[]; next_cursor: string | null }> {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.filters.actor.trim()) query.set("actor", params.filters.actor.trim());
  if (params.filters.category.trim()) query.set("category", params.filters.category.trim());
  if (params.filters.ip.trim()) query.set("ip", params.filters.ip.trim());
  if (params.filters.q.trim()) query.set("q", params.filters.q.trim());
  const res = await adminFetch(`/api/admin/logs?${query.toString()}`);
  const body = (await res.json()) as {
    success?: boolean;
    message?: string;
    items?: AuditLogRow[];
    next_cursor?: string | null;
  };
  if (!res.ok || body.success === false) {
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return {
    items: Array.isArray(body.items) ? body.items : [],
    next_cursor: body.next_cursor ?? null,
  };
}
