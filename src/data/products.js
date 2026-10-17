// Заглушка вместо фото: простая SVG-картинка с эмодзи (работает без интернета)
function placeholder(emoji, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="50%" y="50%" font-size="72" text-anchor="middle" dominant-baseline="central">${emoji}</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export const products = [
  { id: 1, name: "Яблоки", price: 120, image: placeholder("🍎", "#fde2e2") },
  { id: 2, name: "Бананы", price: 90, image: placeholder("🍌", "#fff6c9") },
  { id: 3, name: "Молоко", price: 85, image: placeholder("🥛", "#e3f1ff") },
  { id: 4, name: "Хлеб", price: 60, image: placeholder("🍞", "#f6e7d3") },
  { id: 5, name: "Сыр", price: 340, image: placeholder("🧀", "#fff0c2") },
  { id: 6, name: "Яйца", price: 110, image: placeholder("🥚", "#efe9e1") },
];
