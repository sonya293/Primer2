// REST API магазина услуг на чистом Node.js (без внешних зависимостей).
import http from "node:http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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
  SELECT u.id, u.name, u.email, u.password_hash AS passwordHash, r.name AS role,
         c.id AS couponId, c.title AS couponTitle, c.percent AS couponPercent
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN coupons c ON c.id = u.coupon_id`;

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    coupon: u.couponId ? { id: u.couponId, title: u.couponTitle, percent: u.couponPercent } : null,
  };
}

const SERVICES_SQL = `
  SELECT s.id, s.category_id AS categoryId, c.name AS categoryName, s.name, s.description,
         s.duration_min AS durationMin, s.price, s.discount_percent AS discountPercent
  FROM services s JOIN categories c ON c.id = s.category_id`;

// Итоговая скидка: берётся бо́льшая из скидки на услугу и купона пользователя
const discountFor = (service, couponPercent) =>
  Math.max(service.discount_percent ?? service.discountPercent ?? 0, couponPercent || 0);
const unitPrice = (price, percent) => Math.round((price * (100 - percent)) / 100);

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const toInt = (v) => (Number.isInteger(Number(v)) && v !== "" && v !== null ? Number(v) : NaN);

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

// ---------- Маршруты ----------
const routes = [];
function route(method, pattern, opts, handler) {
  const keys = [];
  const regex = new RegExp(
    "^" + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "$",
  );
  routes.push({ method, regex, keys, opts, handler });
}

// --- Авторизация ---
route("POST", "/api/auth/register", {}, ({ body }) => {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const fields = {};
  if (name.length < 2) fields.name = "Введите имя (не менее 2 символов)";
  if (!isEmail(email)) fields.email = "Введите корректный email";
  if (password.length < 6) fields.password = "Пароль — не менее 6 символов";
  if (Object.keys(fields).length) throw new HttpError(400, "Проверьте поля формы", fields);

  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    throw new HttpError(409, "Пользователь с таким email уже существует", {
      email: "Этот email уже занят",
    });
  }
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role_id)
       VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = 'client'))`,
    )
    .run(name, email, hashPassword(password));
  const user = db.prepare(`${USER_SQL} WHERE u.id = ?`).get(lastInsertRowid);
  return { status: 201, data: { token: makeToken(user.id), user: publicUser(user) } };
});

route("POST", "/api/auth/login", {}, ({ body }) => {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const fields = {};
  if (!email) fields.email = "Введите email";
  else if (!isEmail(email)) fields.email = "Введите корректный email";
  if (!password) fields.password = "Введите пароль";
  if (Object.keys(fields).length) throw new HttpError(400, "Проверьте поля формы", fields);

  const user = db.prepare(`${USER_SQL} WHERE u.email = ?`).get(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new HttpError(401, "Неверный email или пароль");
  }
  return { token: makeToken(user.id), user: publicUser(user) };
});

route("GET", "/api/auth/me", { auth: true }, ({ user }) => ({ user: publicUser(user) }));

// --- Каталог ---
route("GET", "/api/categories", {}, () =>
  db.prepare("SELECT id, name FROM categories ORDER BY id").all(),
);

route("GET", "/api/services", {}, () => db.prepare(`${SERVICES_SQL} ORDER BY s.id`).all());

// --- Оформление корзины: создаёт платёж и записи ---
route("POST", "/api/checkout", { auth: true }, ({ user, body }) => {
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) throw new HttpError(400, "Корзина пуста");

  const method = body.method;
  if (!["card", "cash"].includes(method)) throw new HttpError(400, "Выберите способ оплаты");

  const when = new Date(body.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new HttpError(400, "Укажите дату и время записи");
  if (when.getTime() < Date.now()) throw new HttpError(400, "Дата записи должна быть в будущем");

  return inTransaction(() => {
    const lines = items.map((it) => {
      const qty = toInt(it.qty);
      const service = db
        .prepare("SELECT id, price, discount_percent FROM services WHERE id = ?")
        .get(toInt(it.serviceId));
      if (!service) throw new HttpError(400, "Одна из услуг больше недоступна");
      if (!(qty >= 1 && qty <= 20)) throw new HttpError(400, "Количество должно быть от 1 до 20");
      const percent = discountFor(service, user.couponPercent);
      return { service, qty, percent, price: unitPrice(service.price, percent) };
    });

    const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
    const payment = db
      .prepare("INSERT INTO payments (user_id, amount, method, status) VALUES (?, ?, ?, ?)")
      .run(user.id, total, method, method === "card" ? "paid" : "pending");

    const ins = db.prepare(
      `INSERT INTO appointments
         (user_id, service_id, payment_id, quantity, unit_price, discount_percent, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const l of lines) {
      ins.run(user.id, l.service.id, payment.lastInsertRowid, l.qty, l.price, l.percent, when.toISOString());
    }
    return {
      status: 201,
      data: {
        paymentId: Number(payment.lastInsertRowid),
        total,
        paymentStatus: method === "card" ? "paid" : "pending",
        appointments: lines.length,
      },
    };
  });
});

route("GET", "/api/appointments", { auth: true }, ({ user }) =>
  db
    .prepare(
      `SELECT a.id, s.name AS serviceName, a.quantity, a.unit_price AS unitPrice,
              a.discount_percent AS discountPercent, a.scheduled_at AS scheduledAt,
              a.status, p.method AS paymentMethod, p.status AS paymentStatus
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       LEFT JOIN payments p ON p.id = a.payment_id
       WHERE a.user_id = ? ORDER BY a.id DESC`,
    )
    .all(user.id),
);

// --- Администратор ---
const admin = { auth: true, admin: true };

route("POST", "/api/admin/categories", admin, ({ body }) => {
  const name = String(body.name || "").trim();
  if (name.length < 2 || name.length > 40) {
    throw new HttpError(400, "Название категории — от 2 до 40 символов");
  }
  // lower() в SQLite не работает с кириллицей, поэтому сравниваем в JS
  const exists = db.prepare("SELECT name FROM categories").all();
  if (exists.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    throw new HttpError(409, "Такая категория уже есть");
  }
  const { lastInsertRowid } = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
  return { status: 201, data: { id: Number(lastInsertRowid), name } };
});

route("POST", "/api/admin/services", admin, ({ body }) => {
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const categoryId = toInt(body.categoryId);
  const durationMin = toInt(body.durationMin);
  const price = toInt(body.price);
  const discount = body.discountPercent === undefined || body.discountPercent === "" ? 0 : toInt(body.discountPercent);

  if (name.length < 2) throw new HttpError(400, "Введите название услуги");
  if (!db.prepare("SELECT id FROM categories WHERE id = ?").get(categoryId)) {
    throw new HttpError(400, "Выберите категорию");
  }
  if (!(durationMin > 0)) throw new HttpError(400, "Длительность — целое число минут больше 0");
  if (!(price >= 0)) throw new HttpError(400, "Цена — целое число не меньше 0");
  if (!(discount >= 0 && discount <= 90)) throw new HttpError(400, "Скидка — от 0 до 90%");

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO services (category_id, name, description, duration_min, price, discount_percent)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(categoryId, name, description, durationMin, price, discount);
  return { status: 201, data: db.prepare(`${SERVICES_SQL} WHERE s.id = ?`).get(lastInsertRowid) };
});

// Общая скидка на услугу
route("PUT", "/api/admin/services/:id/discount", admin, ({ params, body }) => {
  const percent = toInt(body.percent);
  if (!(percent >= 0 && percent <= 90)) throw new HttpError(400, "Скидка — целое число от 0 до 90");
  const { changes } = db
    .prepare("UPDATE services SET discount_percent = ? WHERE id = ?")
    .run(percent, toInt(params.id));
  if (!changes) throw new HttpError(404, "Услуга не найдена");
  return db.prepare(`${SERVICES_SQL} WHERE s.id = ?`).get(toInt(params.id));
});

route("GET", "/api/admin/coupons", admin, () =>
  db.prepare("SELECT id, code, title, percent FROM coupons ORDER BY percent").all(),
);

route("POST", "/api/admin/coupons", admin, ({ body }) => {
  const title = String(body.title || "").trim();
  const percent = toInt(body.percent);
  if (title.length < 2) throw new HttpError(400, "Введите название купона");
  if (!(percent >= 1 && percent <= 90)) throw new HttpError(400, "Скидка — целое число от 1 до 90");
  const code = randomBytes(3).toString("hex").toUpperCase();
  const { lastInsertRowid } = db
    .prepare("INSERT INTO coupons (code, title, percent) VALUES (?, ?, ?)")
    .run(code, title, percent);
  return { status: 201, data: { id: Number(lastInsertRowid), code, title, percent } };
});

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
  return publicUser(db.prepare(`${USER_SQL} WHERE u.id = ?`).get(userId));
});

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
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, "Некорректный JSON"));
      }
    });
    req.on("error", reject);
  });
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
        matched = { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
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
