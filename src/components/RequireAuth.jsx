import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Loading } from "./Status.jsx";

// Защита маршрутов: без входа — на /login (с возвратом назад после входа),
// для admin-страниц нужна роль admin
export default function RequireAuth({ admin = false, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading text="Проверка авторизации…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== "admin") {
    return <p className="status status--error">Доступ только для администратора.</p>;
  }
  return children;
}
