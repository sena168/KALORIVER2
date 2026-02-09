import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import id from "./id.json";
import en from "./en.json";

const getInitialLanguage = () => "id";

i18n.use(initReactI18next).init({
  resources: {
    id: { translation: id },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: "id",
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
