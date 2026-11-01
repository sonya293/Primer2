import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "./Navbar.css";

// Верхняя панель: навигация, переключатель темы и кнопка выхода из аккаунта
export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { totalCount } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  // NavLink сам добавляет класс "active" ссылке текущей страницы
  return (
    <nav className="navbar">
      <span className="navbar__logo">Магазин услуг</span>

      <div className="navbar__links">
        <NavLink to="/" end>
          Каталог
        </NavLink>
        {!isAdmin && <NavLink to="/cart">Корзина ({totalCount})</NavLink>}
        {user && <NavLink to="/dashboard">Кабинет</NavLink>}
        {isAdmin && <NavLink to="/admin">Админка</NavLink>}
        {!user && <NavLink to="/login">Вход</NavLink>}
        {!user && <NavLink to="/register">Регистрация</NavLink>}
      </div>

      <div className="navbar__actions">
        {user && <span className="navbar__user">{user.name}</span>}
        {user && (
          <button className="navbar__theme" onClick={handleLogout}>
            Выйти
          </button>
        )}
        <button className="navbar__theme" onClick={toggleTheme}>
          {theme === "light" ? "🌙 Тёмная" : "☀️ Светлая"}
        </button>
      </div>
    </nav>
  );
}
