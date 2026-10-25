import { createContext, useContext, useEffect, useReducer } from "react";

const CartContext = createContext(null);

// Корзина хранит только id услуги и количество: актуальные цены и скидки
// берутся с сервера при показе корзины.
const STORAGE_KEY = "cart_services";

function loadCart() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Редюсер описывает все изменения корзины.
// Состояние — массив позиций вида { id, qty }.
function cartReducer(state, action) {
  switch (action.type) {
    case "ADD": {
      const exists = state.find((item) => item.id === action.id);
      if (exists) {
        // Товар уже в корзине — увеличиваем количество
        return state.map((item) =>
          item.id === action.id
            ? { ...item, qty: item.qty + 1 }
            : item,
        );
      }
      return [...state, { id: action.id, qty: 1 }];
    }
    case "INCREMENT":
      // +1 к количеству выбранного товара
      return state.map((item) =>
        item.id === action.id ? { ...item, qty: item.qty + 1 } : item,
      );
    case "DECREMENT":
      // -1 к количеству; если стало 0 — товар удаляется из корзины
      return state
        .map((item) =>
          item.id === action.id ? { ...item, qty: item.qty - 1 } : item,
        )
        .filter((item) => item.qty > 0);
    case "REMOVE":
      return state.filter((item) => item.id !== action.id);
    case "CLEAR":
      return [];
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  // Третий аргумент — функция, которая вычисляет начальное состояние
  const [items, dispatch] = useReducer(cartReducer, [], loadCart);

  // При каждом изменении корзины сохраняем её в localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addToCart = (service) => dispatch({ type: "ADD", id: service.id });
  const increaseQty = (id) => dispatch({ type: "INCREMENT", id });
  const decreaseQty = (id) => dispatch({ type: "DECREMENT", id });
  const removeFromCart = (id) => dispatch({ type: "REMOVE", id });
  const clearCart = () => dispatch({ type: "CLEAR" });

  const totalCount = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        increaseQty,
        decreaseQty,
        removeFromCart,
        clearCart,
        totalCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}