import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_PREFERENCE_KEY = '@mechbazar_theme_preference';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

const resolveScheme = (preference: ThemePreference): ResolvedScheme => {
  if (preference === 'system') return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  return preference;
};

export const loadThemePreference = async (): Promise<ThemePreference> => {
  try {
    const saved = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch (_) {}
  return 'system'; // default
};

export const saveThemePreference = async (preference: ThemePreference) => {
  try {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
  } catch (_) {}
};

interface ThemeState {
  preference: ThemePreference;
  resolvedScheme: ResolvedScheme;
}

const initialState: ThemeState = {
  preference: 'system',
  resolvedScheme: resolveScheme('system'),
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setThemePreference: (state, action: PayloadAction<ThemePreference>) => {
      state.preference = action.payload;
      state.resolvedScheme = resolveScheme(action.payload);
      saveThemePreference(action.payload);
    },
    setThemePreferenceHydrated: (state, action: PayloadAction<ThemePreference>) => {
      state.preference = action.payload;
      state.resolvedScheme = resolveScheme(action.payload);
    },
    // Dispatched by App.tsx's Appearance.addChangeListener -- only takes
    // effect while preference is 'system' (an explicit light/dark choice
    // shouldn't silently flip when the OS theme changes).
    systemSchemeChanged: (state, action: PayloadAction<ResolvedScheme>) => {
      if (state.preference === 'system') state.resolvedScheme = action.payload;
    },
  },
});

export const { setThemePreference, setThemePreferenceHydrated, systemSchemeChanged } = themeSlice.actions;
export default themeSlice.reducer;
