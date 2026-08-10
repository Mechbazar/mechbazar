import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

// New key, not the old '@mechbazar_language' AccountScreen used to write --
// that one stored a full display label ("Hindi (हिन्दी)"), not a language
// code, and was never read back by anything (see AccountScreen.tsx's old
// handleSelectLanguage). A stale value under the old key is simply ignored.
const LANGUAGE_PREFERENCE_KEY = '@mechbazar_language_code';

export type LanguageCode = 'en' | 'hi';

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: 'English',
  hi: 'हिन्दी (Hindi)',
};

export const loadLanguagePreference = async (): Promise<LanguageCode> => {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_PREFERENCE_KEY);
    if (saved === 'en' || saved === 'hi') return saved;
  } catch (_) {}
  return 'en';
};

export const saveLanguagePreference = async (code: LanguageCode) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, code);
  } catch (_) {}
};

interface LanguageState {
  code: LanguageCode;
}

const initialState: LanguageState = { code: 'en' };

const languageSlice = createSlice({
  name: 'language',
  initialState,
  reducers: {
    // Same side-effecting-reducer shape as themeSlice's setThemePreference --
    // matches this store's existing convention rather than introducing a
    // thunk just for this one slice.
    setLanguage: (state, action: PayloadAction<LanguageCode>) => {
      state.code = action.payload;
      i18n.changeLanguage(action.payload);
      saveLanguagePreference(action.payload);
    },
    setLanguageHydrated: (state, action: PayloadAction<LanguageCode>) => {
      state.code = action.payload;
      i18n.changeLanguage(action.payload);
    },
  },
});

export const { setLanguage, setLanguageHydrated } = languageSlice.actions;
export default languageSlice.reducer;
