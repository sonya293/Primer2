import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Field from "../components/Field.jsx";
import { emailError, nameError, passwordError, phoneError } from "../utils/validators.js";
import "./Login.css";

// Форма регистрации: полное имя, email, телефон, пароль (+ повтор пароля)
export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", repeat: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");

    const found = {
      name: nameError(form.name),
      email: emailError(form.email),
      phone: phoneError(form.phone),
      password: passwordError(form.password),
      repeat: form.repeat !== form.password ? "Пароли не совпадают" : "",
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.phone.trim(), form.password);
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
      <form className="form" onSubmit={handleSubmit} noValidate>
        <Field label="Полное имя" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
        <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} />
        <Field
          label="Телефон"
          type="tel"
          autoComplete="tel"
          placeholder="+7 900 123-45-67"
          value={form.phone}
          onChange={set("phone")}
          error={errors.phone}
        />
        <Field
          label="Пароль"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          hint="От 6 до 64 символов"
        />
        <Field
          label="Повторите пароль"
          type="password"
          autoComplete="new-password"
          value={form.repeat}
          onChange={set("repeat")}
          error={errors.repeat}
        />

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
