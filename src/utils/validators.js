// Проверки полей форм на клиенте. Те же правила повторены на сервере (server/index.js),
// поэтому обойти их запросом в обход интерфейса нельзя.
// Каждая функция возвращает текст ошибки или пустую строку, если всё в порядке.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(value) {
  const v = value.trim();
  if (!v) return "Введите email";
  if (v.length > 100) return "Email слишком длинный (до 100 символов)";
  if (!EMAIL_RE.test(v)) return "Введите корректный email, например name@mail.ru";
  return "";
}

export function nameError(value) {
  const v = value.trim();
  if (!v) return "Введите имя";
  if (v.length < 2 || v.length > 60) return "Имя — от 2 до 60 символов";
  return "";
}

export function phoneError(value) {
  const v = value.trim();
  if (!v) return "Введите телефон";
  if (!/^\+?[\d\s\-()]+$/.test(v)) return "Телефон может содержать только цифры, пробелы, +, ( ) и -";
  const digits = v.replace(/\D/g, "").length;
  if (digits < 10 || digits > 15) return "Телефон — от 10 до 15 цифр";
  return "";
}

export function passwordError(value) {
  if (!value) return "Введите пароль";
  if (value.length < 6) return "Пароль — не менее 6 символов";
  if (value.length > 64) return "Пароль — не более 64 символов";
  return "";
}

// Адрес: required=false — поле можно оставить пустым (адрес по умолчанию в профиле)
export function addressError(value, required = true) {
  const v = value.trim();
  if (!v) return required ? "Введите адрес доставки" : "";
  if (v.length < 5 || v.length > 200) return "Адрес — от 5 до 200 символов";
  return "";
}

// Сегодняшняя дата в формате YYYY-MM-DD по локальному времени
export function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Дата доставки не может быть раньше сегодняшней и дальше чем через год
export function deliveryDateError(value) {
  if (!value) return "Укажите дату доставки";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Некорректная дата";
  if (value < todayStr()) return "Дата доставки не может быть раньше сегодняшней";
  const max = new Date();
  max.setFullYear(max.getFullYear() + 1);
  if (new Date(`${value}T00:00:00`) > max) return "Дата доставки — не позже чем через год";
  return "";
}

export function commentError(value) {
  const v = value.trim();
  if (v.length < 3) return "Напишите комментарий (не менее 3 символов)";
  if (v.length > 1000) return "Комментарий — не длиннее 1000 символов";
  return "";
}

// Целое число в диапазоне; пустую строку считаем ошибкой, если required
export function intError(value, { min, max, label, required = true }) {
  const v = String(value ?? "").trim();
  if (!v) return required ? `${label}: введите число` : "";
  if (!/^\d+$/.test(v)) return `${label}: только целое число`;
  const n = Number(v);
  if (n < min || n > max) return `${label}: от ${min} до ${max}`;
  return "";
}

// Форма услуги в админке
export function serviceFormErrors(f) {
  const errors = {};
  const name = f.name.trim();
  if (name.length < 2 || name.length > 100) errors.name = "Название — от 2 до 100 символов";
  if (!f.categoryId) errors.categoryId = "Выберите категорию";
  if (f.description.trim().length > 500) errors.description = "Описание — до 500 символов";
  const dur = intError(f.durationMin, { min: 1, max: 1440, label: "Минуты" });
  if (dur) errors.durationMin = dur;
  const price = intError(f.price, { min: 0, max: 1000000, label: "Цена" });
  if (price) errors.price = price;
  const disc = intError(f.discountPercent, { min: 0, max: 90, label: "Скидка", required: false });
  if (disc) errors.discountPercent = disc;
  const image = f.image.trim();
  if (image && !/^(\/|https?:\/\/)\S{1,300}$/.test(image)) {
    errors.image = "Путь вида /images/name.jpg или ссылка https://...";
  }
  return errors;
}
