import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { Loading, ErrorMessage } from "../components/Status.jsx";
import { formatPrice, formatDate } from "../utils/pricing.js";

function Appointments() {
  const { data, loading, error, reload } = useFetch("/appointments");

  if (loading) return <Loading text="Загружаем ваши записи…" />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;
  if (data.length === 0) return <p>Записей пока нет.</p>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Услуга</th>
            <th>Дата и время</th>
            <th>Кол-во</th>
            <th>Сумма</th>
            <th>Оплата</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.id}>
              <td>
                {a.serviceName}
                {a.discountPercent > 0 && ` (−${a.discountPercent}%)`}
              </td>
              <td>{formatDate(a.scheduledAt)}</td>
              <td>{a.quantity}</td>
              <td>{formatPrice(a.unitPrice * a.quantity)}</td>
              <td>{a.paymentStatus === "paid" ? "Оплачено" : "На месте"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { totalCount } = useCart();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div>
      <h1>Личный кабинет</h1>
      <p>Здравствуйте, {user.name}!</p>
      <p>
        {user.email} · роль: {user.role === "admin" ? "администратор" : "клиент"}
      </p>
      <p>
        {user.coupon
          ? `Ваш купон: «${user.coupon.title}» — скидка ${user.coupon.percent}%`
          : "Персональной скидки пока нет."}
      </p>
      <p>Услуг в корзине: {totalCount} шт.</p>

      <h2 style={{ marginTop: 32 }}>Мои записи</h2>
      <Appointments />

      <p style={{ marginTop: 24 }}>
        <button className="btn" onClick={handleLogout}>
          Выйти
        </button>
      </p>
    </div>
  );
}
