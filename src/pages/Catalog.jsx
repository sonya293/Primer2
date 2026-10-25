import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ServiceCard from "../components/ServiceCard.jsx";
import { Loading, ErrorMessage } from "../components/Status.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./Catalog.css";

export default function Catalog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const services = useFetch("/services");
  const categories = useFetch("/categories");
  const [lastAdded, setLastAdded] = useState(null);
  const [selected, setSelected] = useState([]); // id отмеченных категорий

  function toggleCategory(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const loading = services.loading || categories.loading;
  const error = services.error || categories.error;

  function retry() {
    if (services.error) services.reload();
    if (categories.error) categories.reload();
  }

  const all = services.data || [];
  // Если ни одна категория не отмечена — показываем все услуги
  const visible = selected.length ? all.filter((s) => selected.includes(s.categoryId)) : all;

  return (
    <div>
      <h1>Каталог услуг</h1>

      {user?.coupon && (
        <p className="coupon-info">
          Ваш купон «{user.coupon.title}»: скидка {user.coupon.percent}% на все услуги
          (если на услугу нет скидки больше).
        </p>
      )}

      {lastAdded && (
        <div className="notice">
          <span>«{lastAdded.name}» добавлена в корзину.</span>
          <button className="btn" onClick={() => navigate("/cart")}>
            Перейти в корзину
          </button>
        </div>
      )}

      {loading && <Loading text="Загружаем каталог услуг…" />}
      {!loading && error && <ErrorMessage message={error} onRetry={retry} />}

      {!loading && !error && (
        <div className="catalog">
          {/* Боковая колонка с фильтрами по категориям */}
          <aside className="catalog__aside" aria-label="Фильтр по категориям">
            <h2>Категории</h2>
            <ul className="filter">
              {categories.data.map((cat) => (
                <li key={cat.id}>
                  <label className="filter__item">
                    <input
                      type="checkbox"
                      checked={selected.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                    />
                    <span className="filter__name">{cat.name}</span>
                    <span className="filter__count">
                      {all.filter((s) => s.categoryId === cat.id).length}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {selected.length > 0 && (
              <button className="btn btn--ghost" onClick={() => setSelected([])}>
                Сбросить фильтр
              </button>
            )}
          </aside>

          <section className="catalog__content">
            {visible.length === 0 ? (
              <p className="status">В выбранных категориях пока нет услуг.</p>
            ) : (
              <div className="services-grid">
                {visible.map((service) => (
                  <ServiceCard key={service.id} service={service} onAdded={setLastAdded} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
