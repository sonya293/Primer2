import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Если токен уже сохранён — сначала проверяем его на сервере
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function authenticate(path, body) {
    const r = await api(path, { method: "POST", body });
    setToken(r.token);
    setUser(r.user);
    return r.user;
  }

  const login = (email, password) => authenticate("/auth/login", { email, password });
  const register = (name, email, password) =>
    authenticate("/auth/register", { name, email, password });

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  // Обновить данные пользователя (например, после выдачи купона)
  const refresh = () => api("/auth/me").then((r) => setUser(r.user));

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
