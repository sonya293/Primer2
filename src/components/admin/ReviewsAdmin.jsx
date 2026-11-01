import { api } from "../../api.js";
import { useFetch } from "../../hooks/useFetch.js";
import { Stars } from "../ReviewsModal.jsx";
import { useAction, Section, DeleteButton } from "./common.jsx";

function ReviewRow({ review, onChanged }) {
  const { msg, busy, run } = useAction();
  async function remove() {
    if (await run(() => api(`/reviews/${review.id}`, { method: "DELETE" }), "Удалён")) onChanged();
  }
  return (
    <tr>
      <td>{review.serviceName}</td>
      <td>{review.userName}</td>
      <td><Stars value={review.rating} /></td>
      <td style={{ overflowWrap: "anywhere" }}>{review.comment}</td>
      <td>
        <DeleteButton disabled={busy} onConfirm={remove} />
        {msg && !msg.ok && <div className="form-error">{msg.text}</div>}
      </td>
    </tr>
  );
}

export default function ReviewsAdmin() {
  const reviews = useFetch("/admin/reviews");
  return (
    <Section title="Отзывы" state={reviews}>
      {reviews.data?.length === 0 ? (
        <p>Отзывов пока нет.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Услуга</th><th>Автор</th><th>Оценка</th><th>Комментарий</th><th /></tr></thead>
            <tbody>{reviews.data?.map((r) => <ReviewRow key={r.id} review={r} onChanged={reviews.reload} />)}</tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
