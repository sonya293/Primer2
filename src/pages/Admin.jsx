import { useState } from "react";
import ServicesAdmin from "../components/admin/ServicesAdmin.jsx";
import CategoriesAdmin from "../components/admin/CategoriesAdmin.jsx";
import UsersAdmin from "../components/admin/UsersAdmin.jsx";
import OrdersAdmin from "../components/admin/OrdersAdmin.jsx";
import ReviewsAdmin from "../components/admin/ReviewsAdmin.jsx";
import "./Admin.css";
import "./Dashboard.css";

const TABS = [
  ["orders", "Заказы", OrdersAdmin],
  ["services", "Услуги", ServicesAdmin],
  ["categories", "Категории", CategoriesAdmin],
  ["users", "Купоны и пользователи", UsersAdmin],
  ["reviews", "Отзывы", ReviewsAdmin],
];

// Администрирование: администратор может добавлять, изменять и удалять все ресурсы сайта
export default function Admin() {
  const [tab, setTab] = useState("orders");
  const Current = TABS.find(([key]) => key === tab)[2];

  return (
    <div className="admin">
      <h1>Администрирование</h1>
      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "tabs__tab tabs__tab--on" : "tabs__tab"} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      <Current />
    </div>
  );
}
