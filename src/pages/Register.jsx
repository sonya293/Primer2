import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./Login.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");

    const found = {};
    if (name.trim().length < 2) found.name = "Введите имя (не менее 2 символов)";
    if (!EMAIL_RE.test(email.trim())) found.email = "Введите корректный email";
    if (password.length < 6) found.password = "Пароль — не менее 6 символов";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
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
      <h1>Регистрация</h1>
      <form className="login" onSubmit={handleSubmit} noValidate>
        <label className="login__field">
          <input
            placeholder="Имя"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <span className="login__error">{errors.name}</span>}
        </label>
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
            placeholder="Пароль (от 6 символов)"
            autoComplete="new-password"
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
          {submitting ? "Создаём аккаунт…" : "Зарегистрироваться"}
        </button>
        <p className="login__hint">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </form>
    </div>
  );
}
