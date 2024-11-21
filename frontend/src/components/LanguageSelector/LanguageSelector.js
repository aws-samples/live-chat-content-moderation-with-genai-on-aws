import React from "react";
import { useTranslation } from "react-i18next";
import styles from "./LanguageSelector.module.css";

const languages = [
  { code: "en", name: "English" },
  { code: "zh", name: "中文" },
  { code: "es", name: "Español" },
  { code: "ar", name: "العربية" },
  { code: "pt", name: "Português" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "fr", name: "Français" },
  { code: "ja", name: "日本語" },
  { code: "ru", name: "Русский" },
  { code: "de", name: "Deutsch" },
  { code: "hi", name: "हिन्दी" },
  { code: "it", name: "Italiano" },
  { code: "tr", name: "Türkçe" },
  { code: "ko", name: "한국어" },
  { code: "vi", name: "Tiếng Việt" },
];

function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <select
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      value={i18n.language}
      className={styles.languageSelector}
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
}

export default LanguageSelector;
