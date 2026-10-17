import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./Login.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();

    // Простая проверка: имя не пустое, пароль не короче 3 символов
    if (name.trim() === "" || password.length < 3) {
      setError("Введите имя и пароль (не менее 3 символов)");
      return;
    }

    login(name.trim());
    // Успешный вход — программный редирект на /dashboard.
    // replace: true убирает /login из истории браузера.
    navigate("/dashboard", { replace: true });
  }

  return (
    <div>
      <h1>Вход</h1>
      <form className="login" onSubmit={handleSubmit}>
        <input
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="login__error">{error}</p>}
        <button className="btn" type="submit">
          Войти
        </button>
      </form>
    </div>
  );
}
