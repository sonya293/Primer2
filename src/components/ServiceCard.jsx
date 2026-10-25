import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { discountFor, unitPrice, formatPrice, formatDuration } from "../utils/pricing.js";
import "./ServiceCard.css";

// Карточка услуги: название, описание, длительность, цена (со скидкой, если она есть).
function ServiceCard({ service, onAdded }) {
  const { items, addToCart } = useCart();
  const { user } = useAuth();
  const coupon = user?.coupon;

  const inCart = items.find((item) => item.id === service.id);
  const percent = discountFor(service, coupon);
  const finalPrice = unitPrice(service, coupon);
  const fromCoupon = coupon && coupon.percent > (service.discountPercent || 0);

  function handleAdd() {
    addToCart(service);
    onAdded(service);
  }

  return (
    <article className="service-card">
      {percent > 0 && (
        <span className="service-card__badge">
          {fromCoupon ? `Купон «${coupon.title}»` : "Скидка"} −{percent}%
        </span>
      )}
      <span className="service-card__category">{service.categoryName}</span>
      <h2 className="service-card__name">{service.name}</h2>
      <p className="service-card__desc">{service.description}</p>
      <p className="service-card__duration">⏱ {formatDuration(service.durationMin)}</p>

      <div className="service-card__prices">
        <span className="service-card__price">{formatPrice(finalPrice)}</span>
        {percent > 0 && (
          <span className="service-card__old-price">{formatPrice(service.price)}</span>
        )}
      </div>

      <button className="service-card__button" onClick={handleAdd}>
        В корзину
      </button>
      <p className="service-card__count">В корзине: {inCart ? inCart.qty : 0} шт.</p>
    </article>
  );
}

export default ServiceCard;
