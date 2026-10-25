import { useCart } from "../context/CartContext.jsx";
import "./ProductCard.css";

// Карточка товара. Данные приходят через props,
// а корзина берётся из глобального контекста.
function ProductCard({ product, onAdded }) {
  const { items, addToCart } = useCart();

  const inCart = items.find((item) => item.id === product.id);

  function handleAdd() {
    addToCart(product);
    onAdded(product); // сообщаем странице, что товар добавлен
  }

  return (
    <div className="product-card">
      <img
        className="product-card__image"
        src={product.image}
        alt={product.name}
      />
      <h2 className="product-card__name">{product.name}</h2>
      <p className="product-card__price">{product.price} ₽</p>

      <button className="product-card__button" onClick={handleAdd}>
        В корзину
      </button>

      <p className="product-card__count">
        В корзине: {inCart ? inCart.qty : 0} шт.
      </p>
    </div>
  );
}

export default ProductCard;