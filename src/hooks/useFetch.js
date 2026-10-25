import { useEffect, useState } from "react";
import { api } from "../api.js";

// Загружает данные с API и отдаёт состояния: loading / error / data.
// reload() повторяет запрос (например, по кнопке «Повторить»).
export function useFetch(path) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    api(path)
      .then((data) => !cancelled && setState({ data, loading: false, error: "" }))
      .catch(
        (e) => !cancelled && setState({ data: null, loading: false, error: e.message }),
      );
    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  return { ...state, reload: () => setAttempt((n) => n + 1) };
}
