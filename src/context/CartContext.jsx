import { createContext, useContext, useReducer } from "react";

const CartContext = createContext(null);

// Редюсер описывает все изменения корзины.
// Состояние — массив позиций вида { id, name, price, image, qty }.
function cartReducer(state, action) {
  switch (action.type) {
    case "ADD": {
      const exists = state.find((item) => item.id === action.product.id);
      if (exists) {
        // Товар уже в корзине — увеличиваем количество
        return state.map((item) =>
          item.id === action.product.id
            ? { ...item, qty: item.qty + 1 }
            : item,
        );
      }
      return [...state, { ...action.product, qty: 1 }];
    }
    case "REMOVE":
      return state.filter((item) => item.id !== action.id);
    case "CLEAR":
      return [];
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, []);

  const addToCart = (product) => dispatch({ type: "ADD", product });
  const removeFromCart = (id) => dispatch({ type: "REMOVE", id });
  const clearCart = () => dispatch({ type: "CLEAR" });

  const totalCount = items.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <CartContext.Provider
      value={{ items, addToCart, removeFromCart, clearCart, totalCount, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
