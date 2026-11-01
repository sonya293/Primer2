import { api } from "../../api.js";
import { useFetch } from "../../hooks/useFetch.js";
import { formatPrice, formatDay, ORDER_STATUS, PAYMENT_STATUS } from "../../utils/pricing.js";
import { useAction, Section, DeleteButton } from "./common.jsx";

function OrderRow({ order, onChanged }) {
  const { msg, busy, run } = useAction();

  async function changeStatus(e) {
    const status = e.target.value;
    if (await run(() => api(`/admin/orders/${order.id}/status`, { method: "PUT", body: { status } }), "Статус изменён")) onChanged();
  }
  async function remove() {
    if (await run(() => api(`/admin/orders/${order.id}`, { method: "DELETE" }), "Удалён")) onChanged();
  }

  return (
    <tr>
      <td>№{order.id}</td>
      <td>{order.userName}<br /><small>{order.userEmail}, {order.userPhone}</small></td>
      <td>{formatDay(order.deliveryDate)}<br /><small>{order.address}</small></td>
      <td>{order.items.map((i, n) => <div key={n}>{i.serviceName} × {i.quantity}</div>)}</td>
      <td>{formatPrice(order.total)}<br /><small>{PAYMENT_STATUS[order.paymentStatus]}</small></td>
      <td>
        <select value={order.status} onChange={changeStatus} disabled={busy}>
          {Object.entries(ORDER_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </td>
      <td>
        <DeleteButton disabled={busy} onConfirm={remove} />
        {msg && <div><small className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</small></div>}
      </td>
    </tr>
  );
}

export default function OrdersAdmin() {
  const orders = useFetch("/admin/orders");
  return (
    <Section title="Заказы" state={orders}>
      {orders.data?.length === 0 ? (
        <p>Заказов пока нет.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>№</th><th>Клиент</th><th>Доставка</th><th>Состав</th><th>Сумма</th><th>Статус</th><th /></tr></thead>
            <tbody>{orders.data?.map((o) => <OrderRow key={o.id} order={o} onChanged={orders.reload} />)}</tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
