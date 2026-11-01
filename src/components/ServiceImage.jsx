import { useState } from "react";
import { photoFor } from "../utils/photos.js";
import "./ServiceImage.css";

// Значок услуги по ключевым словам в названии
const ICONS = [
  [/мужск/i, ""],
  [/стриж|укладк/i, ""],
  [/окраш/i, ""],
  [/педикюр/i, ""],
  [/маникюр|ногт/i, ""],
  [/массаж/i, ""],
  [/чистк|пилинг|биоревит|кожей/i, ""],
  [/обёрт/i, ""],
  [/саун|хаммам/i, ""],
  [/стоун/i, ""],
  [/ароматер/i, ""],
];

const iconFor = (name) => ICONS.find(([re]) => re.test(name))?.[1] || "✨";

// Фон зависит от категории, поэтому у новых категорий тоже будет свой цвет
function backgroundFor(categoryId) {
  const hue = (categoryId * 67) % 360;
  return `linear-gradient(135deg, hsl(${hue} 80% 82%), hsl(${(hue + 35) % 360} 75% 70%))`;
}

// Картинка услуги: настоящее фото (если задано поле image) или иллюстрация-значок
export default function ServiceImage({ service }) {
  const [broken, setBroken] = useState(false);
  // Сначала фото из базы (поле image), затем фото из utils/photos.js, иначе значок
  const photo = service.image || photoFor(service);

  if (photo && !broken) {
    return (
      <img
        className="service-image service-image--photo"
        src={photo}
        alt={service.name}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      className="service-image"
      style={{ background: backgroundFor(service.categoryId) }}
      role="img"
      aria-label={service.name}
    >
      <span className="service-image__icon">{iconFor(service.name)}</span>
    </div>
  );
}