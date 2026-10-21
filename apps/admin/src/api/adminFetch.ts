export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
    },
  });
}

async function readJsonBody<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.trim().slice(0, 240) || res.statusText || "invalid response");
  }
}

export type MeResponse = {
  username: string;
  logged_in: boolean;
  "2fa_enabled"?: boolean;
};

export async function fetchMe(): Promise<MeResponse> {
  const res = await adminFetch("/api/me");
  const body = await readJsonBody<{ status?: string; data?: MeResponse; message?: string }>(res);
  if (!res.ok || body.status === "error") {
    throw new Error(body.message?.trim() || "unauthorized");
  }
  return (body.data ?? { username: "Guest", logged_in: false }) as MeResponse;
}

export class LoginError extends Error {
  needs2fa: boolean;

  constructor(message: string, needs2fa: boolean) {
    super(message);
    this.name = "LoginError";
    this.needs2fa = needs2fa;
  }
}

export async function loginRequest(payload: {
  username: string;
  password: string;
  "2fa_code"?: string;
}): Promise<void> {
  const res = await adminFetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readJsonBody<{
    status?: string;
    message?: string;
    needs_2fa?: boolean;
  }>(res);
  if (!res.ok || body.status === "error") {
    throw new LoginError(
      body.message?.trim() || "login failed",
      Boolean(body.needs_2fa),
    );
  }
}
