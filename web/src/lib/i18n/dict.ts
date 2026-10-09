import ptDict from "./locale-pt.json";
import zhDict from "./locale-zh.json";
import { type Locale, useLocale } from "./store";

// The UI source language is English: every translatable text node renders in
// English and is swapped to the active locale at runtime by the overlay.
// Each table below maps an English source string -> its translation.

// locale-zh.json is authored as { chinese: english } (Chinese was the original
// source language), so it is inverted here into english -> chinese.
export const EN_TO_ZH: Record<string, string> = {};
for (const [zh, en] of Object.entries(zhDict as Record<string, string>)) {
  EN_TO_ZH[en] = zh;
}

// locale-pt.json is authored directly as { english: portuguese } because English
// is the current UI source language, so it is used as-is.
export const EN_TO_PT: Record<string, string> = ptDict as Record<string, string>;

// English is the source language and needs no table.
const TABLES: Partial<Record<Locale, Record<string, string>>> = {
  zh: EN_TO_ZH,
  pt: EN_TO_PT,
};

export function translateTextNode(s: string): string {
  const table = TABLES[useLocale.getState().locale];
  if (!table) {
    return s;
  }
  const exact = table[s];
  if (exact !== undefined) {
    return exact;
  }
  const trimmed = s.trim();
  if (trimmed && table[trimmed] !== undefined) {
    const start = s.indexOf(trimmed);
    return `${s.slice(0, start)}${table[trimmed]}${s.slice(start + trimmed.length)}`;
  }
  return s;
}
