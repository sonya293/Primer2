import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { Loading, ErrorMessage } from "./Status.jsx";
import Field from "./Field.jsx";
import { commentError } from "../utils/validators.js";
import "./ReviewsModal.css";

// Звёзды оценки: «★★★★☆»
export const Stars = ({ value }) => (
  <span className="stars" aria-label={`Оценка ${value} из 5`}>
    {"★".repeat(value)}
    {"☆".repeat(5 - value)}
  </span>
);

// Окно отзывов об услуге: список всех отзывов + форма для авторизованных клиентов
export default function ReviewsModal({ service, onClose, onChanged }) {
  const { user } = useAuth();
  const reviews = useFetch(`/services/${service.id}/reviews`);
  const mine = reviews.data?.find((r) => r.userId === user?.id);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filled, setFilled] = useState(false);

  // Закрытие по Escape
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Когда отзывы загрузились, подставляем в форму уже написанный отзыв пользователя
  useEffect(() => {
    if (mine && !filled) {
      setRating(mine.rating);
      setComment(mine.comment);
      setFilled(true);
    }
  }, [mine, filled]);

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");
    const found = {};
    if (rating < 1) found.rating = "Поставьте оценку от 1 до 5";
    const cErr = commentError(comment);
    if (cErr) found.comment = cErr;
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const body = { rating, comment: comment.trim() };
      if (mine) await api(`/reviews/${mine.id}`, { method: "PUT", body });
      else await api(`/services/${service.id}/reviews`, { method: "POST", body });
      reviews.reload();
      onChanged();
    } catch (err) {
      setErrors(err.fields || {});
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(review) {
    setServerError("");
    try {
      await api(`/reviews/${review.id}`, { method: "DELETE" });
      if (review.id === mine?.id) {
        setRating(0);
        setComment("");
        setFilled(false);
      }
      reviews.reload();
      onChanged();
    } catch (err) {
      setServerError(err.message);
    }
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modal__box"
        role="dialog"
        aria-modal="true"
        aria-label={`Отзывы: ${service.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2>Отзывы: {service.name}</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {reviews.loading && <Loading text="Загружаем отзывы…" />}
        {reviews.error && <ErrorMessage message={reviews.error} onRetry={reviews.reload} />}
        {reviews.data && reviews.data.length === 0 && <p>Отзывов пока нет. Станьте первым!</p>}

        {reviews.data && reviews.data.length > 0 && (
          <ul className="reviews">
            {reviews.data.map((r) => (
              <li key={r.id} className="reviews__item">
                <div className="reviews__top">
                  <b>{r.userName}</b>
                  <Stars value={r.rating} />
                  <small>{new Date(r.createdAt.replace(" ", "T") + "Z").toLocaleDateString("ru-RU")}</small>
                </div>
                <p>{r.comment}</p>
                {(r.userId === user?.id || isAdmin) && (
                  <button className="btn btn--danger reviews__del" onClick={() => remove(r)}>
                    Удалить
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!user && (
          <p className="reviews__login">
            Чтобы оставить отзыв, <Link to="/login">войдите в аккаунт</Link>.
          </p>
        )}

        {user && !isAdmin && reviews.data && (
          <form className="form reviews__form" onSubmit={handleSubmit} noValidate>
            <h3>{mine ? "Ваш отзыв (можно изменить)" : "Оставить отзыв"}</h3>
            <div>
              <div className="reviews__pick" role="radiogroup" aria-label="Оценка">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={n <= rating ? "reviews__star reviews__star--on" : "reviews__star"}
                    onClick={() => setRating(n)}
                    aria-label={`${n} из 5`}
                    aria-pressed={n === rating}
                  >
                    ★
                  </button>
                ))}
              </div>
              {errors.rating && <span className="field__error">{errors.rating}</span>}
            </div>
            <Field
              label="Комментарий"
              as="textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              error={errors.comment}
              maxLength={1000}
            />
            {serverError && <p className="form-error" role="alert">{serverError}</p>}
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "Сохраняем…" : mine ? "Сохранить отзыв" : "Отправить отзыв"}
            </button>
          </form>
        )}
        {isAdmin && serverError && <p className="form-error" role="alert">{serverError}</p>}
      </div>
    </div>
  );
}
