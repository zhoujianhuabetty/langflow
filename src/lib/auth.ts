const TOKEN_KEY = "langflow_token";
const USER_KEY = "langflow_user";

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
}

export function getStoredAuth(): { token: string; user: AuthUser } | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const userStr = localStorage.getItem(USER_KEY);
  if (!token || !userStr) return null;
  try {
    return { token, user: JSON.parse(userStr) };
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function register(email: string, password: string, displayName: string): Promise<{ token: string; user: AuthUser }> {
  let res: Response;
  try {
    res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    });
  } catch {
    throw new Error("无法连接服务器，请确认后端已启动");
  }
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("服务器响应异常，请确认后端已启动（node server.js）");
  }
  if (!res.ok) throw new Error(data.error || "注册失败");
  saveAuth(data.token, data.user);
  return data;
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  let res: Response;
  try {
    res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("无法连接服务器，请确认后端已启动");
  }
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("服务器响应异常，请确认后端已启动（node server.js）");
  }
  if (!res.ok) throw new Error(data.error || "登录失败");
  saveAuth(data.token, data.user);
  return data;
}

export function logout() {
  clearAuth();
}

export async function checkAuth(): Promise<AuthUser | null> {
  const stored = getStoredAuth();
  if (!stored) return null;
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${stored.token}` },
    });
    if (!res.ok) {
      clearAuth();
      return null;
    }
    const data = await res.json();
    return data.user;
  } catch {
    return stored.user; // 离线时用本地缓存
  }
}
