import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    debug: true,
    supportedLngs: [
      "en",
      "zh",
      "es",
      "ar",
      "pt",
      "id",
      "fr",
      "ja",
      "ru",
      "de",
      "hi",
      "it",
      "tr",
      "ko",
      "vi",
    ],
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
