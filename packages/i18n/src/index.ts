import i18n, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import zhCN from "../locales/zh-CN.json";
import en from "../locales/en.json";

/** Default locale for v1. | 首版默认语言。 */
export const DEFAULT_LOCALE = "zh-CN";

/** Locales shipped with the admin bundle. | 管理面板内置语言。 */
export const SUPPORTED_LOCALES = ["zh-CN", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** localStorage key used to persist the chosen locale. | 语言持久化键。 */
export const LOCALE_STORAGE_KEY = "sakuio-admin-lang";

/** Returns the persisted locale, falling back to the default. | 读取持久化语言，缺省回退默认值。 */
export function resolveInitialLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
      return stored as SupportedLocale;
    }
  } catch {
    // localStorage unavailable (private mode); use default.
  }
  return DEFAULT_LOCALE;
}

/** Persists the locale choice. | 持久化语言选择。 */
export function persistLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore persistence failures.
  }
}

const resources = {
  "zh-CN": { translation: zhCN },
  en: { translation: en },
} as const;

/**
 * Creates a configured i18next instance (Simplified Chinese + English).
 * 创建已配置的 i18next 实例（简体中文 + 英文）。
 */
export function createI18n(): I18nInstance {
  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init({
    resources,
    lng: resolveInitialLocale(),
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
  });
  return instance;
}

/** Switches the active locale on the given instance and persists it. | 在指定实例上切换并持久化语言。 */
export async function changeLocale(instance: I18nInstance, locale: SupportedLocale): Promise<void> {
  await instance.changeLanguage(locale);
  persistLocale(locale);
}

export { zhCN, en };
