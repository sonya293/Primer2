// Обёртка над fetch для общения с серверным API (/api проксируется Vite на :3001).
const TOKEN_KEY = "token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Нет связи с сервером. Проверьте подключение.", 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // тело ответа не JSON
  }

  if (!res.ok) {
    const message =
      data?.error ||
      (res.status >= 500
        ? "Сервер недоступен. Запустите его командой npm run server."
        : `Ошибка запроса (код ${res.status})`);
    throw new ApiError(message, res.status, data?.fields);
  }
  return data;
}
