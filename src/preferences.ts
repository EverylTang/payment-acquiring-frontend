import { reactive } from "vue";

export type AppLocale = "zh-CN" | "en-US";
export type AppTheme = "indigo" | "blue" | "emerald" | "midnight";

const localeKey = "payment-admin:locale";
const themeKey = "payment-admin:theme";
const themeOptions: AppTheme[] = ["indigo", "blue", "emerald", "midnight"];

const readPreference = (key: string) =>
  typeof window === "undefined" ? null : window.localStorage.getItem(key);

export const preferences = reactive<{
  locale: AppLocale;
  theme: AppTheme;
}>({
  locale: readPreference(localeKey) === "en-US" ? "en-US" : "zh-CN",
  theme: themeOptions.includes(readPreference(themeKey) as AppTheme)
    ? (readPreference(themeKey) as AppTheme)
    : "indigo",
});

const applyPreferences = () => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = preferences.locale;
  document.documentElement.dataset.theme = preferences.theme;
};

export const setLocale = (locale: AppLocale) => {
  preferences.locale = locale;
  window.localStorage.setItem(localeKey, locale);
  applyPreferences();
};

export const setTheme = (theme: AppTheme) => {
  preferences.theme = theme;
  window.localStorage.setItem(themeKey, theme);
  applyPreferences();
};

applyPreferences();
