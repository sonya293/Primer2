import { NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "./Navbar.css";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { totalCount } = useCart();
  const { user } = useAuth();

  // NavLink сам добавляет класс "active" ссылке текущей страницы
  return (
    <nav className="navbar">
      <span className="navbar__logo">Магазин услуг</span>

      <div className="navbar__links">
        <NavLink to="/" end>
          Каталог
        </NavLink>
        <NavLink to="/cart">Корзина ({totalCount})</NavLink>
        <NavLink to="/dashboard">Кабинет</NavLink>
        {user?.role === "admin" && <NavLink to="/admin">Админка</NavLink>}
        {!user && <NavLink to="/login">Вход</NavLink>}
        {!user && <NavLink to="/register">Регистрация</NavLink>}
      </div>

      <button className="navbar__theme" onClick={toggleTheme}>
        {theme === "light" ? "🌙 Тёмная" : "☀️ Светлая"}
      </button>
    </nav>
  );
}