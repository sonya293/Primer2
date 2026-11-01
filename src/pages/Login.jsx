import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Field from "../components/Field.jsx";
import { emailError } from "../utils/validators.js";
import "./Login.css";

// Форма входа: email + пароль, проверка до отправки и показ ошибок сервера
export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Уже вошли — форма не нужна
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");

    const found = {};
    const emailErr = emailError(email);
    if (emailErr) found.email = emailErr;
    if (!password) found.password = "Введите пароль";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const u = await login(email.trim(), password);
      // Возвращаем пользователя туда, откуда его отправили на вход
      navigate(location.state?.from || (u.role === "admin" ? "/admin" : "/dashboard"), { replace: true });
    } catch (err) {
      setErrors(err.fields || {});
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Вход</h1>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Field
          label="Пароль"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        {serverError && (
          <p className="login__error login__error--box" role="alert">
            {serverError}
          </p>
        )}

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "Входим…" : "Войти"}
        </button>
        <p className="login__hint">
          <Link to="/forgot-password">Забыли пароль?</Link>
        </p>
        <p className="login__hint">
          Нет аккаунта? <Link to="/register">Регистрация</Link>
        </p>
        <p className="login__hint">Демо: admin@shop.ru / admin123, anna@example.com / user123</p>
      </form>
    </div>
  );
}
