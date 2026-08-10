import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';

// Started at 'en' -- App.tsx's boot effect calls languageSlice's hydration
// action as soon as the persisted preference loads from AsyncStorage, which
// calls i18n.changeLanguage() itself (see languageSlice.ts), so this default
// only matters for the brief pre-hydration render.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export default i18n;
