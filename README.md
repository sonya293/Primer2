# Магазин: каталог, корзина и тема (React + Vite + React Router)

## Запуск
1. Установите Node.js (https://nodejs.org, версия 20 или новее).
2. В папке проекта выполните:

   npm install
   npm run dev

3. Откройте адрес из терминала (обычно http://localhost:5173).

## Структура (src)
- main.jsx                  — точка входа: BrowserRouter и провайдеры контекстов
- App.jsx                   — меню и маршруты (Routes / Route)
- context/ThemeContext.jsx  — глобальная тема (light / dark)
- context/CartContext.jsx   — глобальная корзина (useReducer + Context)
- context/AuthContext.jsx   — пользователь (вход / выход)
- components/Navbar.jsx     — меню на NavLink + кнопка смены темы
- components/ProductCard.jsx — карточка товара
- pages/Catalog.jsx, Cart.jsx, Login.jsx, Dashboard.jsx, NotFound.jsx — страницы
- data/products.js          — список товаров

## Страницы
/ — каталог, /cart — корзина, /login — вход, /dashboard — личный кабинет
