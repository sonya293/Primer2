import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { totalCount, totalPrice } = useCart();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Без входа личный кабинет недоступен — перенаправляем на /login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div>
      <h1>Личный кабинет</h1>
      <p>Здравствуйте, {user}!</p>
      <p>
        Товаров в корзине: {totalCount} шт. на сумму {totalPrice} ₽
      </p>
      <p>Текущая тема: {theme === "light" ? "светлая" : "тёмная"}</p>
      <p style={{ marginTop: 16 }}>
        <button className="btn" onClick={handleLogout}>
          Выйти
        </button>
      </p>
    </div>
  );
}
