import { useState } from "react";

function FormExample() {
  const [text, setText] = useState("");

  function handleChange(e) {
    setText(e.target.value);
  }

  return (
    <div>
      <input value={text} onChange={handleChange} />
      <p>Вы ввели: {text}</p>
    </div>
  );
}

export default FormExample;
