export const LOCALES = {
  en: { label: "English", badge: "EN", languageTag: "en-US" },
  zh: { label: "中文", badge: "中", languageTag: "zh-CN" },
  pt: { label: "Português (Brasil)", badge: "PT", languageTag: "pt-BR" },
} as const;

export type Locale = keyof typeof LOCALES;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(LOCALES, value);
}
