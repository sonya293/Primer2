import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Field from "../components/Field.jsx";
import { emailError, passwordError } from "../utils/validators.js";
import "./Login.css";

// Восстановление пароля в два шага: 1) email -> код, 2) код + новый пароль.
// Почты в учебном проекте нет, поэтому сервер возвращает код прямо в ответе (demoCode).
export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function requestCode(e) {
    e.preventDefault();
    setServerError("");
    const err = emailError(email);
    setErrors(err ? { email: err } : {});
    if (err) return;

    setSubmitting(true);
    try {
      const r = await api("/auth/forgot", { method: "POST", body: { email: email.trim() } });
      setDemoCode(r.demoCode || "");
      setStep(2);
    } catch (e2) {
      setErrors(e2.fields || {});
      setServerError(e2.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setServerError("");
    const found = {
      code: /^\d{6}$/.test(code.trim()) ? "" : "Код — 6 цифр",
      password: passwordError(password),
      repeat: repeat !== password ? "Пароли не совпадают" : "",
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    try {
      await api("/auth/reset", {
        method: "POST",
        body: { email: email.trim(), code: code.trim(), password },
      });
      setStep(3);
    } catch (e2) {
      setErrors(e2.fields || {});
      setServerError(e2.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 3) {
    return (
      <div>
        <h1>Пароль изменён</h1>
        <p className="status status--ok">Теперь вы можете войти с новым паролем.</p>
        <p className="login__hint">
          <Link to="/login">Перейти ко входу</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Восстановление пароля</h1>

      {step === 1 && (
        <form className="form" onSubmit={requestCode} noValidate>
          <p>Введите email, с которым вы регистрировались. Мы создадим одноразовый код.</p>
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          {serverError && <p className="login__error login__error--box" role="alert">{serverError}</p>}
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Отправляем…" : "Получить код"}
          </button>
          <p className="login__hint">
            Вспомнили пароль? <Link to="/login">Войти</Link>
          </p>
        </form>
      )}

      {step === 2 && (
        <form className="form" onSubmit={resetPassword} noValidate>
          {demoCode ? (
            <p className="status status--ok">
              Учебная версия: письма не отправляются, ваш код — <b>{demoCode}</b> (действует 15 минут).
            </p>
          ) : (
            <p>Если такой email зарегистрирован, код создан. Он действует 15 минут.</p>
          )}
          <Field label="Код из 6 цифр" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} error={errors.code} />
          <Field label="Новый пароль" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="От 6 до 64 символов" />
          <Field label="Повторите пароль" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} error={errors.repeat} />
          {serverError && <p className="login__error login__error--box" role="alert">{serverError}</p>}
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Сохраняем…" : "Сменить пароль"}
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => { setStep(1); setErrors({}); setServerError(""); }}>
            Запросить код заново
          </button>
        </form>
      )}
    </div>
  );
}
