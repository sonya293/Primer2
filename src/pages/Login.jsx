import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./Login.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Проверка на клиенте до отправки запроса
function validate(email, password) {
  const errors = {};
  if (!email.trim()) errors.email = "Введите email";
  else if (!EMAIL_RE.test(email.trim())) errors.email = "Введите корректный email";
  if (!password) errors.password = "Введите пароль";
  return errors;
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");

    const found = validate(email, password);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/dashboard", { replace: true });
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
      <form className="login" onSubmit={handleSubmit} noValidate>
        <label className="login__field">
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <span className="login__error">{errors.email}</span>}
        </label>

        <label className="login__field">
          <input
            type="password"
            placeholder="Пароль"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
          />
          {errors.password && <span className="login__error">{errors.password}</span>}
        </label>

        {serverError && (
          <p className="login__error login__error--box" role="alert">
            {serverError}
          </p>
        )}

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "Входим…" : "Войти"}
        </button>
        <p className="login__hint">
          Нет аккаунта? <Link to="/register">Регистрация</Link>
        </p>
        <p className="login__hint">
          Демо: admin@shop.ru / admin123, anna@example.com / user123
        </p>
      </form>
    </div>
  );
}
