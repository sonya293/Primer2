import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Loading } from "./Status.jsx";

// Защита маршрутов: без входа — на /login, для admin-страниц нужна роль admin
export default function RequireAuth({ admin = false, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading text="Проверка авторизации…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") {
    return <p className="status status--error">Доступ только для администратора.</p>;
  }
  return children;
}
