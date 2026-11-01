import { Stars } from "./ReviewsModal.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { discountFor, unitPrice, formatPrice, formatDuration } from "../utils/pricing.js";
import ServiceImage from "./ServiceImage.jsx";
import "./ServiceCard.css";

// Карточка услуги: название, описание, длительность, цена (со скидкой, если она есть).
function ServiceCard({ service, onAdded, onError, onOpenReviews }) {
  const { items, addToCart, busy } = useCart();
  const { user } = useAuth();
  const coupon = user?.coupon;
  const isAdmin = user?.role === "admin";

  const inCart = items.find((item) => item.serviceId === service.id);
  const percent = discountFor(service, coupon);
  const finalPrice = unitPrice(service, coupon);
  const fromCoupon = coupon && coupon.percent > (service.discountPercent || 0);

  // Корзина хранится на сервере, поэтому гостю сначала нужно войти
  async function handleAdd() {
    if (!user) {
      onError("Чтобы добавить услугу в корзину, войдите в аккаунт.", true);
      return;
    }
    try {
      await addToCart(service.id);
      onAdded(service);
    } catch (e) {
      onError(e.message);
    }
  }

  return (
    <article className="service-card">
      <ServiceImage service={service} />
      <div className="service-card__top">
        <span className="service-card__category">{service.categoryName}</span>
        {percent > 0 && (
          <span className="service-card__badge">
            {fromCoupon ? `Купон «${coupon.title}»` : "Скидка"} −{percent}%
          </span>
        )}
      </div>
      <h2 className="service-card__name">{service.name}</h2>
      <p className="service-card__desc">{service.description}</p>
      <p className="service-card__duration">⏱ {formatDuration(service.durationMin)}</p>
      <button className="service-card__reviews" onClick={() => onOpenReviews(service)}>
        {service.reviewsCount > 0 ? (
          <>
            <Stars value={Math.round(service.avgRating)} /> {service.avgRating} · отзывов: {service.reviewsCount}
          </>
        ) : (
          "Отзывов пока нет — оставить"
        )}
      </button>

      <div className="service-card__prices">
        <span className="service-card__price">{formatPrice(finalPrice)}</span>
        {percent > 0 && (
          <span className="service-card__old-price">{formatPrice(service.price)}</span>
        )}
      </div>

      {!isAdmin && (
        <>
          <button className="service-card__button" onClick={handleAdd} disabled={busy}>
            В корзину
          </button>
          <p className="service-card__count">В корзине: {inCart ? inCart.qty : 0} шт.</p>
        </>
      )}
    </article>
  );
}

export default ServiceCard;
