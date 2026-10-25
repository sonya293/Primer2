// База данных SQLite (встроенный модуль node:sqlite, нужен Node.js 22.5+).
// Таблицы: roles, users, categories, coupons, services, payments, appointments.
import { DatabaseSync } from "node:sqlite";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DB_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "shop.db");

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const test = scryptSync(password, salt, 64);
  return timingSafeEqual(test, Buffer.from(hash, "hex"));
}

db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  -- Виды скидочных купонов (персональная скидка пользователя)
  CREATE TABLE IF NOT EXISTS coupons (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    code    TEXT NOT NULL UNIQUE,
    title   TEXT NOT NULL,
    percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 90)
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id       INTEGER NOT NULL REFERENCES roles(id),
    coupon_id     INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS services (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id      INTEGER NOT NULL REFERENCES categories(id),
    name             TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    duration_min     INTEGER NOT NULL CHECK (duration_min > 0),
    price            INTEGER NOT NULL CHECK (price >= 0),
    discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 90)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    amount     INTEGER NOT NULL,
    method     TEXT NOT NULL CHECK (method IN ('card', 'cash')),
    status     TEXT NOT NULL CHECK (status IN ('paid', 'pending')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    service_id       INTEGER NOT NULL REFERENCES services(id),
    payment_id       INTEGER REFERENCES payments(id),
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    unit_price       INTEGER NOT NULL,          -- цена за 1 шт. уже со скидкой
    discount_percent INTEGER NOT NULL DEFAULT 0, -- применённая скидка
    scheduled_at     TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'booked',
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------- Начальные данные (только при пустой базе) ----------
function seed() {
  if (db.prepare("SELECT COUNT(*) AS n FROM roles").get().n > 0) return;

  const insRole = db.prepare("INSERT INTO roles (name) VALUES (?)");
  insRole.run("admin");
  insRole.run("client");

  const insCoupon = db.prepare("INSERT INTO coupons (code, title, percent) VALUES (?, ?, ?)");
  insCoupon.run("NEWBIE", "Новичок", 5);
  insCoupon.run("SILVER", "Серебряный", 10);
  insCoupon.run("GOLD", "Золотой", 15);
  insCoupon.run("VIP", "VIP", 20);

  const insUser = db.prepare(
    "INSERT INTO users (name, email, password_hash, role_id, coupon_id) VALUES (?, ?, ?, ?, ?)",
  );
  insUser.run("Администратор", "admin@shop.ru", hashPassword("admin123"), 1, null);
  insUser.run("Анна Петрова", "anna@example.com", hashPassword("user123"), 2, 3);
  insUser.run("Иван Сидоров", "ivan@example.com", hashPassword("user123"), 2, 1);

  const cats = ["Парикмахерские услуги", "Маникюр и педикюр", "Массаж", "Косметология", "СПА-программы"];
  const insCat = db.prepare("INSERT INTO categories (name) VALUES (?)");
  cats.forEach((c) => insCat.run(c));

  // [категория, название, описание, минуты, цена, скидка %]
  // 20 услуг, у 6 из них (30%) есть общая скидка
  const services = [
    [1, "Женская стрижка", "Стрижка с мытьём головы и укладкой", 60, 1800, 0],
    [1, "Мужская стрижка", "Классическая или модельная стрижка", 45, 1200, 15],
    [1, "Окрашивание волос", "Однотонное окрашивание профессиональными красителями", 150, 4500, 0],
    [1, "Укладка", "Повседневная или вечерняя укладка", 40, 1500, 0],
    [2, "Классический маникюр", "Обработка кутикулы и придание формы ногтям", 45, 1300, 10],
    [2, "Маникюр с гель-лаком", "Маникюр с покрытием стойким гель-лаком", 90, 2200, 0],
    [2, "Аппаратный педикюр", "Обработка стоп и ногтей с покрытием", 75, 2400, 0],
    [2, "Наращивание ногтей", "Наращивание и дизайн гелем", 120, 3500, 20],
    [3, "Массаж спины", "Классический лечебный массаж спины", 30, 1600, 0],
    [3, "Общий массаж тела", "Расслабляющий массаж всего тела", 60, 3000, 0],
    [3, "Массаж лица", "Лифтинг-массаж лица и шеи", 40, 2000, 25],
    [3, "Антицеллюлитный массаж", "Интенсивный массаж проблемных зон", 50, 2500, 0],
    [4, "Чистка лица", "Комбинированная чистка кожи лица", 70, 3200, 0],
    [4, "Химический пилинг", "Мягкое обновление кожи фруктовыми кислотами", 45, 2800, 0],
    [4, "Биоревитализация", "Инъекционное увлажнение кожи гиалуроновой кислотой", 60, 6500, 30],
    [4, "Уход за кожей лица", "Маска, сыворотка и массаж лица", 50, 2600, 0],
    [5, "Обёртывание", "Водорослевое обёртывание для тела", 60, 3300, 0],
    [5, "Сауна и хаммам", "Посещение сауны и хаммама с чаепитием", 90, 2900, 10],
    [5, "Стоун-терапия", "Массаж горячими камнями", 80, 4200, 0],
    [5, "Ароматерапия", "Расслабляющая процедура с эфирными маслами", 45, 2100, 0],
  ];
  const insService = db.prepare(
    `INSERT INTO services (category_id, name, description, duration_min, price, discount_percent)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  services.forEach((s) => insService.run(...s));
}

seed();
