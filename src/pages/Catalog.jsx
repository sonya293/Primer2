import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ServiceCard from "../components/ServiceCard.jsx";
import ReviewsModal from "../components/ReviewsModal.jsx";
import { Loading, ErrorMessage } from "../components/Status.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { useAuth } from "../context/AuthContext.jsx";
import { unitPrice } from "../utils/pricing.js";
import "./Catalog.css";

// Каталог услуг: фильтры по категориям и цене, поиск, сортировка, отзывы
export default function Catalog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const services = useFetch("/services");
  const categories = useFetch("/categories");
  const [notice, setNotice] = useState(null); // { text, ok, login }
  const [reviewsFor, setReviewsFor] = useState(null); // услуга, чьи отзывы открыты
  const [selected, setSelected] = useState([]); // id отмеченных категорий
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("default");

  function toggleCategory(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const loading = services.loading || categories.loading;
  const error = services.error || categories.error;

  function retry() {
    if (services.error) services.reload();
    if (categories.error) categories.reload();
  }

  // Проверка полей цены: только неотрицательные целые, «от» не больше «до»
  const bad = (v) => v !== "" && !/^\d{1,7}$/.test(v);
  let priceError = "";
  if (bad(minPrice) || bad(maxPrice)) priceError = "Цена — целое неотрицательное число";
  else if (minPrice !== "" && maxPrice !== "" && Number(minPrice) > Number(maxPrice)) {
    priceError = "Цена «от» не может быть больше цены «до»";
  }

  const all = services.data || [];
  const q = query.trim().toLowerCase();
  let visible = all.filter((s) => {
    const price = unitPrice(s, user?.coupon); // фильтруем по цене, которую увидит пользователь
    if (selected.length && !selected.includes(s.categoryId)) return false;
    if (q && !`${s.name} ${s.description}`.toLowerCase().includes(q)) return false;
    if (!priceError && minPrice !== "" && price < Number(minPrice)) return false;
    if (!priceError && maxPrice !== "" && price > Number(maxPrice)) return false;
    return true;
  });
  if (sort === "cheap") visible = [...visible].sort((a, b) => unitPrice(a, user?.coupon) - unitPrice(b, user?.coupon));
  if (sort === "expensive") visible = [...visible].sort((a, b) => unitPrice(b, user?.coupon) - unitPrice(a, user?.coupon));
  if (sort === "rating") visible = [...visible].sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));

  const filtersOn = selected.length > 0 || q || minPrice !== "" || maxPrice !== "" || sort !== "default";
  function resetFilters() {
    setSelected([]);
    setQuery("");
    setMinPrice("");
    setMaxPrice("");
    setSort("default");
  }

  return (
    <div>
      <h1>Каталог услуг</h1>

      {user?.coupon && (
        <p className="coupon-info">
          Ваш купон «{user.coupon.title}»: скидка {user.coupon.percent}% на все услуги (если на
          услугу нет скидки больше).
        </p>
      )}

      {notice && (
        <div className={notice.ok ? "notice" : "notice notice--error"} role="status">
          <span>{notice.text}</span>
          {notice.ok && (
            <button className="btn" onClick={() => navigate("/cart")}>
              Перейти в корзину
            </button>
          )}
          {notice.login && <Link to="/login">Войти</Link>}
        </div>
      )}

      {loading && <Loading text="Загружаем каталог услуг…" />}
      {!loading && error && <ErrorMessage message={error} onRetry={retry} />}

      {!loading && !error && (
        <div className="catalog">
          <aside className="catalog__aside" aria-label="Фильтры">
            <h2>Поиск</h2>
            <input
              className="catalog__input"
              placeholder="Название услуги"
              maxLength={100}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <h2>Категории</h2>
            <ul className="filter">
              {categories.data.map((cat) => (
                <li key={cat.id}>
                  <label className="filter__item">
                    <input type="checkbox" checked={selected.includes(cat.id)} onChange={() => toggleCategory(cat.id)} />
                    <span className="filter__name">{cat.name}</span>
                    <span className="filter__count">{all.filter((s) => s.categoryId === cat.id).length}</span>
                  </label>
                </li>
              ))}
            </ul>

            <h2>Цена, ₽</h2>
            <div className="catalog__price">
              <input className="catalog__input" inputMode="numeric" placeholder="от" value={minPrice} onChange={(e) => setMinPrice(e.target.value.trim())} aria-invalid={Boolean(priceError)} />
              <input className="catalog__input" inputMode="numeric" placeholder="до" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.trim())} aria-invalid={Boolean(priceError)} />
            </div>
            {priceError && <p className="form-error">{priceError}</p>}

            <h2>Сортировка</h2>
            <select className="catalog__input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="default">По умолчанию</option>
              <option value="cheap">Сначала дешёвые</option>
              <option value="expensive">Сначала дорогие</option>
              <option value="rating">По рейтингу</option>
            </select>

            {filtersOn && (
              <button className="btn btn--ghost" onClick={resetFilters}>
                Сбросить фильтры
              </button>
            )}
          </aside>

          <section className="catalog__content">
            {visible.length === 0 ? (
              <p className="status">По вашему запросу услуг не найдено.</p>
            ) : (
              <div className="services-grid">
                {visible.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onAdded={(s) => setNotice({ ok: true, text: `«${s.name}» добавлена в корзину.` })}
                    onError={(text, login) => setNotice({ ok: false, text, login })}
                    onOpenReviews={setReviewsFor}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {reviewsFor && (
        <ReviewsModal service={reviewsFor} onClose={() => setReviewsFor(null)} onChanged={services.reload} />
      )}
    </div>
  );
}
