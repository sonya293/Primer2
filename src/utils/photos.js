// Папка с фотографиями внутри public/.
// Если ваши файлы лежат в public/images/services — поменяйте на "/images/services".
const DIR = "/images";

// Массаж, косметология и СПА: одна фотография на всю категорию
const BY_CATEGORY = {
  "Массаж": "massage.jpg",
  "Косметология": "cosmetology.jpg",
  "СПА-программы": "spa.jpg",
};

// Остальные услуги: фотография по слову в названии (порядок важен)
const BY_NAME = [
  [/мужск/i, "menprakt.jfif"],
  [/стриж/i, "womencut.jfif"],
  [/окраш/i, "colorhair.jpg"],
  [/укладк/i, "styling.jpg"],
  [/гель/i, "manicuregellak.jpg"],
  [/наращ/i, "narashnails.jpg"],
  [/педикюр/i, "aparatpedicure.jpg"],
  [/маникюр/i, "classicmanicure.jpg"],
];

// Путь к фото услуги или пустая строка (тогда покажется иллюстрация-значок)
export function photoFor(service) {
  const file =
    BY_CATEGORY[service.categoryName] ?? BY_NAME.find(([re]) => re.test(service.name))?.[1];
  return file ? `${DIR}/${file}` : "";
}