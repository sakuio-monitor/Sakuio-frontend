import { adminFetch } from "./adminFetch";

type ApiEnvelope<T> = {
  status?: string;
  message?: string;
  data?: T;
};

async function accountRequest<T>(path: string, body: unknown): Promise<T> {
  const res = await adminFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || payload.status === "error") {
    throw new Error(payload.message?.trim() || `Request failed (${res.status})`);
  }
  return (payload.data ?? {}) as T;
}

export async function changeUsername(username: string): Promise<{ username: string }> {
  return accountRequest("/api/admin/account/username", { username });
}

export async function changePassword(newPassword: string, repeatPassword: string): Promise<void> {
  await accountRequest("/api/admin/account/password", {
    new_password: newPassword,
    repeat_password: repeatPassword,
  });
}

export async function setupTwoFactor(): Promise<{ secret: string; otpauth_url: string; qr_svg?: string }> {
  return accountRequest("/api/admin/2fa/setup", {});
}

export async function enableTwoFactor(code: string): Promise<void> {
  await accountRequest("/api/admin/2fa/enable", { "2fa_code": code });
}

export async function disableTwoFactor(code: string): Promise<void> {
  await accountRequest("/api/admin/2fa/disable", { "2fa_code": code });
}
