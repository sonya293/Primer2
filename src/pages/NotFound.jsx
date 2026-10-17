import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div>
      <h1>404</h1>
      <p>Страница не найдена.</p>
      <p style={{ marginTop: 12 }}>
        <Link to="/" style={{ color: "var(--accent)" }}>
          На главную
        </Link>
      </p>
    </div>
  );
}
