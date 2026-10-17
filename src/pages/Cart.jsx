import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import "./Cart.css";

export default function Cart() {
  const { items, removeFromCart, clearCart, totalPrice } = useCart();

  if (items.length === 0) {
    return (
      <div>
        <h1>Корзина</h1>
        <p>Корзина пуста.</p>
        <p className="cart__back">
          <Link to="/">Перейти в каталог</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Корзина</h1>

      <ul className="cart__list">
        {items.map((item) => (
          <li key={item.id} className="cart__row">
            <span className="cart__name">
              {item.name} × {item.qty}
            </span>
            <span className="cart__price">{item.price * item.qty} ₽</span>
            <button
              className="btn btn--danger"
              onClick={() => removeFromCart(item.id)}
            >
              Удалить
            </button>
          </li>
        ))}
      </ul>

      <p className="cart__total">Итого: {totalPrice} ₽</p>
      <button className="btn" onClick={clearCart}>
        Очистить корзину
      </button>
    </div>
  );
}
