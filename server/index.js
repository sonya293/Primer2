// REST API магазина услуг на чистом Node.js (без внешних зависимостей).
import http from "node:http";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { db, hashPassword, verifyPassword } from "./db.js";

const PORT = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

// ---------- Токены (подписанные HMAC, как упрощённый JWT) ----------
const b64 = (s) => Buffer.from(s).toString("base64url");
const sign = (data) => createHmac("sha256", SECRET).update(data).digest("base64url");

function makeToken(userId) {
  const payload = b64(JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  const [payload, sig] = (token || "").split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? data.uid : null;
  } catch {
    return null;
  }
}

// ---------- Вспомогательные функции ----------
const USER_SQL = `
  SELECT u.id, u.name, u.email, u.phone, u.address, u.password_hash AS passwordHash,
         r.name AS role, c.id AS couponId, c.title AS couponTitle, c.percent AS couponPercent
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN coupons c ON c.id = u.coupon_id`;

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    address: u.address,
    role: u.role,
    coupon: u.couponId ? { id: u.couponId, title: u.couponTitle, percent: u.couponPercent } : null,
  };
}

// Услуги + категория (JOIN) + средняя оценка и число отзывов
const SERVICES_SQL = `
  SELECT s.id, s.category_id AS categoryId, c.name AS categoryName, s.name, s.description,
         s.duration_min AS durationMin, s.price, s.discount_percent AS discountPercent, s.image,
         (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE service_id = s.id) AS avgRating,
         (SELECT COUNT(*) FROM reviews WHERE service_id = s.id) AS reviewsCount
  FROM services s JOIN categories c ON c.id = s.category_id`;

// Итоговая скидка: берётся бо́льшая из скидки на услугу и купона пользователя
const discountFor = (service, couponPercent) =>
  Math.max(service.discount_percent ?? service.discountPercent ?? 0, couponPercent || 0);
const unitPrice = (price, percent) => Math.round((price * (100 - percent)) / 100);

// ---------- Проверка входных данных ----------
// Любое значение, пришедшее с клиента, считаем недоверенным: берём только строки
const str = (v) => (typeof v === "string" ? v.trim() : "");
const isEmail = (s) => s.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const toInt = (v) =>
  (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && Number.isInteger(Number(v))
    ? Number(v)
    : NaN;

// Телефон: допускаем + пробелы, скобки и дефисы, но цифр должно быть от 10 до 15
function phoneError(phone) {
  if (!phone) return "Введите телефон";
  if (!/^\+?[\d\s\-()]+$/.test(phone)) return "Телефон может содержать только цифры, пробелы, +, ( ) и -";
  const digits = phone.replace(/\D/g, "").length;
  if (digits < 10 || digits > 15) return "Телефон — от 10 до 15 цифр";
  return null;
}

const nameError = (name) =>
  name.length < 2 || name.length > 60 ? "Имя — от 2 до 60 символов" : null;
const passwordError = (p) =>
  typeof p !== "string" || p.length < 6 || p.length > 64 ? "Пароль — от 6 до 64 символов" : null;
const addressError = (a) =>
  a.length < 5 || a.length > 200 ? "Адрес — от 5 до 200 символов" : null;

// Собирает ошибки полей в один ответ 400
function check(errors) {
  const fields = Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
  if (Object.keys(fields).length) throw new HttpError(400, "Проверьте поля формы", fields);
}

// Сегодняшняя дата YYYY-MM-DD (по локальному времени сервера)
const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Дата доставки: формат YYYY-MM-DD, существующая, не раньше сегодня и не дальше чем через год
function deliveryDateError(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Укажите дату доставки";
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return "Такой даты не существует";
  if (value < todayStr()) return "Дата доставки не может быть раньше сегодняшней";
  const max = new Date();
  max.setFullYear(max.getFullYear() + 1);
  if (d.getTime() > max.getTime()) return "Дата доставки — не позже чем через год";
  return null;
}

function inTransaction(fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

const getUser = (id) => db.prepare(`${USER_SQL} WHERE u.id = ?`).get(id);

// Проверка уникальности email (кроме самого пользователя)
function assertEmailFree(email, exceptId = 0) {
  if (db.prepare("SELECT id FROM users WHERE email = ? AND id <> ?").get(email, exceptId)) {
    throw new HttpError(409, "Пользователь с таким email уже существует", { email: "Этот email уже занят" });
  }
}

// ---------- Маршруты ----------
const routes = [];
function route(method, pattern, opts, handler) {
  const keys = [];
  const regex = new RegExp(
    "^" + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "$",
  );
  routes.push({ method, regex, keys, opts, handler });
}

// ===== Авторизация =====
route("POST", "/api/auth/register", {}, ({ body }) => {
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const phone = str(body.phone);
  const password = body.password;
  check({
    name: nameError(name),
    email: isEmail(email) ? null : "Введите корректный email",
    phone: phoneError(phone),
    password: passwordError(password),
  });
  assertEmailFree(email);
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, phone, role_id)
       VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = 'client'))`,
    )
    .run(name, email, hashPassword(password), phone);
  const user = getUser(lastInsertRowid);
  return { status: 201, data: { token: makeToken(user.id), user: publicUser(user) } };
});

route("POST", "/api/auth/login", {}, ({ body }) => {
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  check({
    email: !email ? "Введите email" : isEmail(email) ? null : "Введите корректный email",
    password: password ? null : "Введите пароль",
  });
  const user = db.prepare(`${USER_SQL} WHERE u.email = ?`).get(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new HttpError(401, "Неверный email или пароль");
  }
  return { token: makeToken(user.id), user: publicUser(user) };
});

route("GET", "/api/auth/me", { auth: true }, ({ user }) => ({ user: publicUser(user) }));

// Забыли пароль, шаг 1: выдаём одноразовый код.
// Настоящей почты в учебном проекте нет, поэтому код возвращается в ответе и пишется в консоль сервера.
route("POST", "/api/auth/forgot", {}, ({ body }) => {
  const email = str(body.email).toLowerCase();
  check({ email: isEmail(email) ? null : "Введите корректный email" });
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  const answer = { message: "Если такой email зарегистрирован, код восстановления создан." };
  if (!user) return answer; // не раскрываем, есть ли такой email в базе
  const code = String(randomInt(100000, 1000000));
  db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(user.id);
  db.prepare("INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES (?, ?, ?)").run(
    user.id,
    hashPassword(code),
    Date.now() + 15 * 60 * 1000,
  );
  console.log(`Код восстановления для ${email}: ${code}`);
  return { ...answer, demoCode: code };
});

// Шаг 2: код + новый пароль
route("POST", "/api/auth/reset", {}, ({ body }) => {
  const email = str(body.email).toLowerCase();
  const code = str(body.code);
  check({
    email: isEmail(email) ? null : "Введите корректный email",
    code: /^\d{6}$/.test(code) ? null : "Код — 6 цифр",
    password: passwordError(body.password),
  });
  const fail = () => new HttpError(400, "Код неверный или устарел. Запросите новый.");
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  const reset = user && db.prepare("SELECT * FROM password_resets WHERE user_id = ?").get(user.id);
  if (!reset || reset.expires_at < Date.now() || reset.attempts >= 5) throw fail();
  if (!verifyPassword(code, reset.code_hash)) {
    db.prepare("UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?").run(reset.id);
    throw fail();
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(body.password), user.id);
  db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(user.id);
  return { message: "Пароль изменён. Теперь можно войти." };
});

// ===== Профиль =====
route("PUT", "/api/profile", { auth: true }, ({ user, body }) => {
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const phone = str(body.phone);
  const address = str(body.address);
  check({
    name: nameError(name),
    email: isEmail(email) ? null : "Введите корректный email",
    phone: phoneError(phone),
    address: address && addressError(address), // адрес по умолчанию необязателен
  });
  assertEmailFree(email, user.id);
  db.prepare("UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?").run(
    name, email, phone, address, user.id,
  );
  return { user: publicUser(getUser(user.id)) };
});

route("PUT", "/api/profile/password", { auth: true }, ({ user, body }) => {
  const oldPassword = typeof body.oldPassword === "string" ? body.oldPassword : "";
  check({
    oldPassword: oldPassword ? null : "Введите текущий пароль",
    newPassword: passwordError(body.newPassword),
  });
  if (!verifyPassword(oldPassword, user.passwordHash)) {
    throw new HttpError(400, "Текущий пароль указан неверно", { oldPassword: "Неверный пароль" });
  }
  if (body.newPassword === oldPassword) {
    throw new HttpError(400, "Новый пароль совпадает со старым", { newPassword: "Придумайте другой пароль" });
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(body.newPassword), user.id);
  return { message: "Пароль изменён" };
});

// ===== Каталог =====
route("GET", "/api/categories", {}, () =>
  db.prepare("SELECT id, name FROM categories ORDER BY id").all(),
);

route("GET", "/api/services", {}, () =>
  db.prepare(`${SERVICES_SQL} WHERE s.is_active = 1 ORDER BY s.id`).all(),
);

// ===== Отзывы =====
const REVIEWS_SQL = `
  SELECT r.id, r.rating, r.comment, r.created_at AS createdAt, r.user_id AS userId,
         u.name AS userName, s.name AS serviceName
  FROM reviews r
  JOIN users u ON u.id = r.user_id
  JOIN services s ON s.id = r.service_id`;

route("GET", "/api/services/:id/reviews", {}, ({ params }) => {
  const id = toInt(params.id);
  if (!db.prepare("SELECT id FROM services WHERE id = ? AND is_active = 1").get(id)) {
    throw new HttpError(404, "Услуга не найдена");
  }
  return db.prepare(`${REVIEWS_SQL} WHERE r.service_id = ? ORDER BY r.id DESC`).all(id);
});

function reviewInput(body) {
  const rating = toInt(body.rating);
  const comment = str(body.comment);
  check({
    rating: rating >= 1 && rating <= 5 ? null : "Поставьте оценку от 1 до 5",
    comment: comment.length < 3 ? "Напишите комментарий (не менее 3 символов)"
      : comment.length > 1000 ? "Комментарий — не длиннее 1000 символов" : null,
  });
  return { rating, comment };
}

// Оставить отзыв (только авторизованные; один отзыв на услугу)
route("POST", "/api/services/:id/reviews", { auth: true }, ({ user, params, body }) => {
  const serviceId = toInt(params.id);
  if (!db.prepare("SELECT id FROM services WHERE id = ? AND is_active = 1").get(serviceId)) {
    throw new HttpError(404, "Услуга не найдена");
  }
  const { rating, comment } = reviewInput(body);
  if (db.prepare("SELECT id FROM reviews WHERE user_id = ? AND service_id = ?").get(user.id, serviceId)) {
    throw new HttpError(409, "Вы уже оставили отзыв на эту услугу. Его можно изменить.");
  }
  const { lastInsertRowid } = db
    .prepare("INSERT INTO reviews (user_id, service_id, rating, comment) VALUES (?, ?, ?, ?)")
    .run(user.id, serviceId, rating, comment);
  return { status: 201, data: db.prepare(`${REVIEWS_SQL} WHERE r.id = ?`).get(lastInsertRowid) };
});

// Изменить отзыв: автор — свой, администратор — любой
route("PUT", "/api/reviews/:id", { auth: true }, ({ user, params, body }) => {
  const id = toInt(params.id);
  const review = db.prepare("SELECT user_id FROM reviews WHERE id = ?").get(id);
  if (!review) throw new HttpError(404, "Отзыв не найден");
  if (review.user_id !== user.id && user.role !== "admin") throw new HttpError(403, "Это не ваш отзыв");
  const { rating, comment } = reviewInput(body);
  db.prepare("UPDATE reviews SET rating = ?, comment = ? WHERE id = ?").run(rating, comment, id);
  return db.prepare(`${REVIEWS_SQL} WHERE r.id = ?`).get(id);
});

route("DELETE", "/api/reviews/:id", { auth: true }, ({ user, params }) => {
  const id = toInt(params.id);
  const review = db.prepare("SELECT user_id FROM reviews WHERE id = ?").get(id);
  if (!review) throw new HttpError(404, "Отзыв не найден");
  if (review.user_id !== user.id && user.role !== "admin") throw new HttpError(403, "Это не ваш отзыв");
  db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
  return { id };
});

// ===== Корзина (хранится в БД, у каждого пользователя своя) =====
const noAdminCart = (user) => {
  if (user.role === "admin") throw new HttpError(403, "У администратора нет корзины");
};

// Строки корзины с ценами: услуга подтягивается через JOIN, цена считается на сервере
function loadCart(user) {
  const rows = db
    .prepare(
      `SELECT ci.quantity, s.id AS serviceId, s.name, s.description, s.duration_min AS durationMin,
              s.price, s.discount_percent AS discountPercent, c.name AS categoryName
       FROM cart_items ci
       JOIN services s ON s.id = ci.service_id
       JOIN categories c ON c.id = s.category_id
       WHERE ci.user_id = ? AND s.is_active = 1
       ORDER BY ci.id`,
    )
    .all(user.id);
  const items = rows.map((r) => {
    const percent = discountFor(r, user.couponPercent);
    const price = unitPrice(r.price, percent);
    return { ...r, percent, unitPrice: price, lineTotal: price * r.quantity };
  });
  return {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    total: items.reduce((n, i) => n + i.lineTotal, 0),
    fullTotal: items.reduce((n, i) => n + i.price * i.quantity, 0),
  };
}

route("GET", "/api/cart", { auth: true }, ({ user }) => {
  noAdminCart(user);
  return loadCart(user);
});

// Добавить услугу (+1 к количеству, если она уже есть)
route("POST", "/api/cart", { auth: true }, ({ user, body }) => {
  noAdminCart(user);
  const serviceId = toInt(body.serviceId);
  if (!db.prepare("SELECT id FROM services WHERE id = ? AND is_active = 1").get(serviceId)) {
    throw new HttpError(404, "Услуга не найдена или удалена из каталога");
  }
  const row = db.prepare("SELECT quantity FROM cart_items WHERE user_id = ? AND service_id = ?").get(user.id, serviceId);
  if (row && row.quantity >= 20) throw new HttpError(400, "Нельзя добавить больше 20 штук одной услуги");
  if (row) {
    db.prepare("UPDATE cart_items SET quantity = quantity + 1 WHERE user_id = ? AND service_id = ?").run(user.id, serviceId);
  } else {
    db.prepare("INSERT INTO cart_items (user_id, service_id, quantity) VALUES (?, ?, 1)").run(user.id, serviceId);
  }
  return { status: 201, data: loadCart(user) };
});

// Задать количество
route("PUT", "/api/cart/:serviceId", { auth: true }, ({ user, params, body }) => {
  noAdminCart(user);
  const quantity = toInt(body.quantity);
  if (!(quantity >= 1 && quantity <= 20)) throw new HttpError(400, "Количество должно быть от 1 до 20");
  const { changes } = db
    .prepare("UPDATE cart_items SET quantity = ? WHERE user_id = ? AND service_id = ?")
    .run(quantity, user.id, toInt(params.serviceId));
  if (!changes) throw new HttpError(404, "Этой услуги нет в корзине");
  return loadCart(user);
});

route("DELETE", "/api/cart/:serviceId", { auth: true }, ({ user, params }) => {
  noAdminCart(user);
  db.prepare("DELETE FROM cart_items WHERE user_id = ? AND service_id = ?").run(user.id, toInt(params.serviceId));
  return loadCart(user);
});

route("DELETE", "/api/cart", { auth: true }, ({ user }) => {
  noAdminCart(user);
  db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(user.id);
  return loadCart(user);
});

// ===== Заказы =====
// Оформление заказа: берёт корзину из БД, создаёт платёж, заказ и позиции, очищает корзину
route("POST", "/api/orders", { auth: true }, ({ user, body }) => {
  noAdminCart(user);
  const address = str(body.address);
  const deliveryDate = str(body.deliveryDate);
  check({
    address: addressError(address),
    deliveryDate: deliveryDateError(deliveryDate),
    method: ["card", "cash"].includes(body.method) ? null : "Выберите способ оплаты",
  });

  return inTransaction(() => {
    const cart = loadCart(user);
    if (cart.items.length === 0) throw new HttpError(400, "Корзина пуста");

    const payment = db
      .prepare("INSERT INTO payments (user_id, amount, method, status) VALUES (?, ?, ?, ?)")
      .run(user.id, cart.total, body.method, body.method === "card" ? "paid" : "pending");
    const order = db
      .prepare("INSERT INTO orders (user_id, payment_id, address, delivery_date) VALUES (?, ?, ?, ?)")
      .run(user.id, payment.lastInsertRowid, address, deliveryDate);

    const ins = db.prepare(
      `INSERT INTO appointments
         (user_id, service_id, payment_id, order_id, quantity, unit_price, discount_percent, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const l of cart.items) {
      ins.run(user.id, l.serviceId, payment.lastInsertRowid, order.lastInsertRowid, l.quantity, l.unitPrice, l.percent, deliveryDate);
    }
    db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(user.id);
    return {
      status: 201,
      data: {
        orderId: Number(order.lastInsertRowid),
        total: cart.total,
        paymentStatus: body.method === "card" ? "paid" : "pending",
        positions: cart.items.length,
      },
    };
  });
});

// Заказы с позициями: заказ, платёж и услуги подтягиваются через JOIN
const ORDERS_SQL = `
  SELECT o.id, o.address, o.delivery_date AS deliveryDate, o.status, o.created_at AS createdAt,
         u.name AS userName, u.email AS userEmail, u.phone AS userPhone,
         p.method AS paymentMethod, p.status AS paymentStatus, p.amount AS total
  FROM orders o
  JOIN users u ON u.id = o.user_id
  LEFT JOIN payments p ON p.id = o.payment_id`;

function withItems(orders) {
  const q = db.prepare(
    `SELECT s.name AS serviceName, a.quantity, a.unit_price AS unitPrice, a.discount_percent AS discountPercent
     FROM appointments a JOIN services s ON s.id = a.service_id
     WHERE a.order_id = ? ORDER BY a.id`,
  );
  return orders.map((o) => ({ ...o, items: q.all(o.id) }));
}

route("GET", "/api/orders", { auth: true }, ({ user }) =>
  withItems(db.prepare(`${ORDERS_SQL} WHERE o.user_id = ? ORDER BY o.id DESC`).all(user.id)),
);

// ===== Администратор =====
const admin = { auth: true, admin: true };

// --- Категории ---
const categoryName = (body) => {
  const name = str(body.name);
  if (name.length < 2 || name.length > 40) throw new HttpError(400, "Название категории — от 2 до 40 символов");
  return name;
};
// lower() в SQLite не работает с кириллицей, поэтому сравниваем в JS
function assertCategoryFree(name, exceptId = 0) {
  const all = db.prepare("SELECT id, name FROM categories").all();
  if (all.some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase())) {
    throw new HttpError(409, "Такая категория уже есть");
  }
}

route("POST", "/api/admin/categories", admin, ({ body }) => {
  const name = categoryName(body);
  assertCategoryFree(name);
  const { lastInsertRowid } = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
  return { status: 201, data: { id: Number(lastInsertRowid), name } };
});

route("PUT", "/api/admin/categories/:id", admin, ({ params, body }) => {
  const id = toInt(params.id);
  const name = categoryName(body);
  assertCategoryFree(name, id);
  const { changes } = db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(name, id);
  if (!changes) throw new HttpError(404, "Категория не найдена");
  return { id, name };
});

route("DELETE", "/api/admin/categories/:id", admin, ({ params }) => {
  const id = toInt(params.id);
  if (db.prepare("SELECT COUNT(*) AS n FROM services WHERE category_id = ? AND is_active = 1").get(id).n > 0) {
    throw new HttpError(409, "В категории есть услуги. Сначала удалите их или перенесите в другую категорию.");
  }
  // скрытые (удалённые) услуги тоже ссылаются на категорию — удалить её можно только если ссылок нет
  if (db.prepare("SELECT COUNT(*) AS n FROM services WHERE category_id = ?").get(id).n > 0) {
    throw new HttpError(409, "Категорию нельзя удалить: на неё ссылаются прошлые заказы.");
  }
  const { changes } = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  if (!changes) throw new HttpError(404, "Категория не найдена");
  return { id };
});

// --- Услуги ---
function serviceInput(body) {
  const name = str(body.name);
  const description = str(body.description);
  const image = str(body.image);
  const categoryId = toInt(body.categoryId);
  const durationMin = toInt(body.durationMin);
  const price = toInt(body.price);
  const emptyDiscount = body.discountPercent === undefined || body.discountPercent === "" || body.discountPercent === null;
  const discount = emptyDiscount ? 0 : toInt(body.discountPercent);
  check({
    name: name.length < 2 || name.length > 100 ? "Название — от 2 до 100 символов" : null,
    description: description.length > 500 ? "Описание — не длиннее 500 символов" : null,
    image: image && !/^(\/|https?:\/\/)\S{1,300}$/.test(image)
      ? "Картинка: путь вида /images/services/name.jpg или ссылка https://..." : null,
    categoryId: db.prepare("SELECT id FROM categories WHERE id = ?").get(categoryId) ? null : "Выберите категорию",
    durationMin: durationMin > 0 && durationMin <= 1440 ? null : "Длительность — целое число минут от 1 до 1440",
    price: price >= 0 && price <= 1000000 ? null : "Цена — целое число от 0 до 1 000 000",
    discountPercent: discount >= 0 && discount <= 90 ? null : "Скидка — целое число от 0 до 90",
  });
  return { name, description, image, categoryId, durationMin, price, discount };
}

route("POST", "/api/admin/services", admin, ({ body }) => {
  const v = serviceInput(body);
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO services (category_id, name, description, duration_min, price, discount_percent, image)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(v.categoryId, v.name, v.description, v.durationMin, v.price, v.discount, v.image);
  return { status: 201, data: db.prepare(`${SERVICES_SQL} WHERE s.id = ?`).get(lastInsertRowid) };
});

// Редактирование всех полей услуги
route("PUT", "/api/admin/services/:id", admin, ({ params, body }) => {
  const id = toInt(params.id);
  const v = serviceInput(body);
  const { changes } = db
    .prepare(
      `UPDATE services SET category_id = ?, name = ?, description = ?, duration_min = ?,
              price = ?, discount_percent = ?, image = ? WHERE id = ? AND is_active = 1`,
    )
    .run(v.categoryId, v.name, v.description, v.durationMin, v.price, v.discount, v.image, id);
  if (!changes) throw new HttpError(404, "Услуга не найдена");
  return db.prepare(`${SERVICES_SQL} WHERE s.id = ?`).get(id);
});

// Удаление услуги: она скрывается из каталога и корзин, а старые заказы клиентов сохраняются
route("DELETE", "/api/admin/services/:id", admin, ({ params }) => {
  const id = toInt(params.id);
  const { changes } = db.prepare("UPDATE services SET is_active = 0 WHERE id = ? AND is_active = 1").run(id);
  if (!changes) throw new HttpError(404, "Услуга не найдена");
  db.prepare("DELETE FROM cart_items WHERE service_id = ?").run(id);
  return { id };
});

// --- Купоны ---
route("GET", "/api/admin/coupons", admin, () =>
  db.prepare("SELECT id, code, title, percent FROM coupons ORDER BY percent").all(),
);

function couponInput(body) {
  const title = str(body.title);
  const percent = toInt(body.percent);
  check({
    title: title.length < 2 || title.length > 30 ? "Название купона — от 2 до 30 символов" : null,
    percent: percent >= 1 && percent <= 90 ? null : "Скидка — целое число от 1 до 90",
  });
  return { title, percent };
}

route("POST", "/api/admin/coupons", admin, ({ body }) => {
  const { title, percent } = couponInput(body);
  const code = randomBytes(3).toString("hex").toUpperCase();
  const { lastInsertRowid } = db
    .prepare("INSERT INTO coupons (code, title, percent) VALUES (?, ?, ?)")
    .run(code, title, percent);
  return { status: 201, data: { id: Number(lastInsertRowid), code, title, percent } };
});

route("PUT", "/api/admin/coupons/:id", admin, ({ params, body }) => {
  const id = toInt(params.id);
  const { title, percent } = couponInput(body);
  const { changes } = db.prepare("UPDATE coupons SET title = ?, percent = ? WHERE id = ?").run(title, percent, id);
  if (!changes) throw new HttpError(404, "Купон не найден");
  return db.prepare("SELECT id, code, title, percent FROM coupons WHERE id = ?").get(id);
});

// Удаление купона: у пользователей он снимается автоматически (ON DELETE SET NULL)
route("DELETE", "/api/admin/coupons/:id", admin, ({ params }) => {
  const id = toInt(params.id);
  const { changes } = db.prepare("DELETE FROM coupons WHERE id = ?").run(id);
  if (!changes) throw new HttpError(404, "Купон не найден");
  return { id };
});

// --- Пользователи ---
route("GET", "/api/admin/users", admin, () =>
  db.prepare(`${USER_SQL} ORDER BY u.id`).all().map(publicUser),
);

// Выдача (или снятие) персонального купона пользователю
route("PUT", "/api/admin/users/:id/coupon", admin, ({ params, body }) => {
  const userId = toInt(params.id);
  const couponId = body.couponId === null || body.couponId === "" ? null : toInt(body.couponId);
  if (couponId !== null && !db.prepare("SELECT id FROM coupons WHERE id = ?").get(couponId)) {
    throw new HttpError(400, "Такого купона нет");
  }
  const { changes } = db.prepare("UPDATE users SET coupon_id = ? WHERE id = ?").run(couponId, userId);
  if (!changes) throw new HttpError(404, "Пользователь не найден");
  return publicUser(getUser(userId));
});

// Редактирование данных пользователя (роль не меняется)
route("PUT", "/api/admin/users/:id", admin, ({ params, body }) => {
  const id = toInt(params.id);
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const phone = str(body.phone);
  const address = str(body.address);
  check({
    name: nameError(name),
    email: isEmail(email) ? null : "Введите корректный email",
    phone: phoneError(phone),
    address: address && addressError(address),
  });
  if (!getUser(id)) throw new HttpError(404, "Пользователь не найден");
  assertEmailFree(email, id);
  db.prepare("UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?").run(name, email, phone, address, id);
  return publicUser(getUser(id));
});

route("DELETE", "/api/admin/users/:id", admin, ({ user, params }) => {
  const id = toInt(params.id);
  if (id === user.id) throw new HttpError(400, "Нельзя удалить самого себя");
  if (!getUser(id)) throw new HttpError(404, "Пользователь не найден");
  if (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id = ?").get(id).n > 0) {
    throw new HttpError(409, "У пользователя есть заказы — удалить его нельзя.");
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(id); // корзина и отзывы удаляются каскадом
  return { id };
});

// --- Заказы и отзывы ---
route("GET", "/api/admin/orders", admin, () =>
  withItems(db.prepare(`${ORDERS_SQL} ORDER BY o.id DESC`).all()),
);

route("PUT", "/api/admin/orders/:id/status", admin, ({ params, body }) => {
  const id = toInt(params.id);
  if (!["new", "processing", "done", "cancelled"].includes(body.status)) {
    throw new HttpError(400, "Недопустимый статус заказа");
  }
  const { changes } = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(body.status, id);
  if (!changes) throw new HttpError(404, "Заказ не найден");
  return withItems(db.prepare(`${ORDERS_SQL} WHERE o.id = ?`).all(id))[0];
});

route("DELETE", "/api/admin/orders/:id", admin, ({ params }) => {
  const id = toInt(params.id);
  const order = db.prepare("SELECT payment_id FROM orders WHERE id = ?").get(id);
  if (!order) throw new HttpError(404, "Заказ не найден");
  inTransaction(() => {
    db.prepare("DELETE FROM appointments WHERE order_id = ?").run(id);
    db.prepare("DELETE FROM orders WHERE id = ?").run(id);
    if (order.payment_id) db.prepare("DELETE FROM payments WHERE id = ?").run(order.payment_id);
  });
  return { id };
});

route("GET", "/api/admin/reviews", admin, () =>
  db.prepare(`${REVIEWS_SQL} ORDER BY r.id DESC`).all(),
);

// ---------- HTTP-сервер ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) reject(new HttpError(413, "Слишком большой запрос"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        const data = JSON.parse(raw);
        // тело запроса должно быть объектом, а не null, числом или массивом
        if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error("bad");
        resolve(data);
      } catch {
        reject(new HttpError(400, "Некорректный JSON"));
      }
    });
    req.on("error", reject);
  });
}

function safeDecode(v) {
  try {
    return decodeURIComponent(v);
  } catch {
    throw new HttpError(400, "Некорректный адрес запроса");
  }
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let matched = null;
    let pathMatches = false;
    for (const r of routes) {
      const m = r.regex.exec(url.pathname);
      if (!m) continue;
      pathMatches = true;
      if (r.method === req.method) {
        matched = { r, params: Object.fromEntries(r.keys.map((k, i) => [k, safeDecode(m[i + 1])])) };
        break;
      }
    }
    if (!matched) throw new HttpError(pathMatches ? 405 : 404, pathMatches ? "Метод не поддерживается" : "Маршрут не найден");

    const { r, params } = matched;
    let user = null;
    if (r.opts.auth) {
      const header = req.headers.authorization || "";
      const uid = readToken(header.startsWith("Bearer ") ? header.slice(7) : "");
      user = uid ? db.prepare(`${USER_SQL} WHERE u.id = ?`).get(uid) : null;
      if (!user) throw new HttpError(401, "Требуется авторизация");
      if (r.opts.admin && user.role !== "admin") throw new HttpError(403, "Недостаточно прав");
    }

    const body = req.method === "GET" ? {} : await readBody(req);
    const result = await r.handler({ params, body, user });
    if (result && result.status && "data" in result) send(res, result.status, result.data);
    else send(res, 200, result);
  } catch (e) {
    if (e instanceof HttpError) send(res, e.status, { error: e.message, fields: e.fields });
    else {
      console.error(e);
      send(res, 500, { error: "Внутренняя ошибка сервера" });
    }
  }
});

server.listen(PORT, () => console.log(`API: http://localhost:${PORT}/api`));