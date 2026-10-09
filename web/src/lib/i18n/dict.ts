import zhDict from "./locale-zh.json";
import type { Locale } from "./locales";
import ptDict from "./locales/pt-BR";
import { useLocale } from "./store";
import { createTranslator, type Dictionary } from "./translate";

// Preserve the original Chinese-to-English catalog format.
export const EN_TO_ZH: Record<string, string> = Object.fromEntries(Object.entries(zhDict).map(([zh, en]) => [en, zh]));
export const EN_TO_PT: Dictionary = ptDict;

const TRANSLATORS = {
  en: createTranslator(),
  zh: createTranslator(EN_TO_ZH),
  pt: createTranslator(EN_TO_PT),
};

export function translateTextNode(text: string, locale: Locale = useLocale.getState().locale): string {
  return TRANSLATORS[locale](text);
}
