import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import { products } from "../data/products.js";

export default function Catalog() {
  const navigate = useNavigate();
  const [lastAdded, setLastAdded] = useState(null);

  return (
    <div>
      <h1>Каталог товаров</h1>

      {/* Сообщение после добавления: можно перейти в корзину программно */}
      {lastAdded && (
        <div className="notice">
          <span>«{lastAdded.name}» добавлен в корзину.</span>
          <button className="btn" onClick={() => navigate("/cart")}>
            Перейти в корзину
          </button>
        </div>
      )}

      <div className="products">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAdded={setLastAdded}
          />
        ))}
      </div>
    </div>
  );
}
