import "./Field.css";

// Поле формы: подпись, ввод и текст ошибки под ним.
// as: "input" | "textarea" | "select" (для select внутрь передаются <option>)
export default function Field({ label, error, hint, as = "input", children, ...props }) {
  const Control = as;
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <Control className="field__control" aria-invalid={Boolean(error)} {...props}>
        {children}
      </Control>
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
