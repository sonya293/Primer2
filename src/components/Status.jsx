// Единые сообщения о загрузке и ошибке запроса к API.
export function Loading({ text = "Загрузка данных…" }) {
  return (
    <p className="status status--loading" role="status">
      <span className="spinner" aria-hidden="true" /> {text}
    </p>
  );
}

export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="status status--error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}
