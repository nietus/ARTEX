import { LOCALES, type Locale } from "./locales";
import { useLocale } from "./store";

export function getFormattingLocale(locale: Locale = useLocale.getState().locale): string {
  return LOCALES[locale].languageTag;
}

// Resolve the active locale when formatting, rather than at module load.
export function createDateFormatter(options: Intl.DateTimeFormatOptions) {
  return {
    format: (value: Date | number) => new Intl.DateTimeFormat(getFormattingLocale(), options).format(value),
  };
}
