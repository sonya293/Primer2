import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "./AuthContext.jsx";

const CartContext = createContext(null);

const EMPTY = { items: [], count: 0, total: 0, fullTotal: 0 };

// Корзина хранится на сервере (таблица cart_items), поэтому она у каждого пользователя
// своя и сохраняется после выхода. Цены и скидки считает сервер.
export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false); // идёт запрос на изменение корзины
  const [attempt, setAttempt] = useState(0);

  // У администратора и гостя корзины нет
  const userId = user && user.role !== "admin" ? user.id : null;
  const couponId = user?.coupon?.id ?? null; // сменился купон — цены надо пересчитать

  useEffect(() => {
    if (!userId) {
      setCart(EMPTY);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api("/cart")
      .then((data) => !cancelled && setCart(data))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId, couponId, attempt]);

  // Выполняет запрос к API и обновляет корзину ответом сервера.
  // Ошибку пробрасываем дальше, чтобы компонент показал её пользователю.
  async function mutate(path, options) {
    setBusy(true);
    try {
      setCart(await api(path, options));
    } finally {
      setBusy(false);
    }
  }

  const addToCart = (serviceId) => mutate("/cart", { method: "POST", body: { serviceId } });
  const setQuantity = (serviceId, quantity) =>
    mutate(`/cart/${serviceId}`, { method: "PUT", body: { quantity } });
  const removeFromCart = (serviceId) => mutate(`/cart/${serviceId}`, { method: "DELETE" });
  const clearCart = () => mutate("/cart", { method: "DELETE" });
  const reload = () => setAttempt((n) => n + 1);
  // После оформления заказа сервер уже очистил корзину — просто обнуляем состояние
  const resetCart = () => setCart(EMPTY);

  return (
    <CartContext.Provider
      value={{
        cart,
        items: cart.items,
        totalCount: cart.count,
        loading,
        error,
        busy,
        addToCart,
        setQuantity,
        removeFromCart,
        clearCart,
        reload,
        resetCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
