"use client";

import { Fragment, type ReactNode, useEffect } from "react";

import { translateTextNode } from "./dict";
import { startDomOverlay } from "./dom-overlay";
import { LOCALES } from "./locales";
import { useLocale } from "./store";

export function OverlayProvider({ children }: { children: ReactNode }) {
  const locale = useLocale((state) => state.locale);
  const hydrated = useLocale((state) => state.hydrated);

  useEffect(() => {
    void useLocale.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = LOCALES[locale].languageTag;
    if (locale === "en") return;
    return startDomOverlay(document.body, (text) => translateTextNode(text, locale));
  }, [locale, hydrated]);

  // Re-render the locale-dependent date formatting after persisted state is loaded.
  // Language selection already reloads the page to keep React's text tree intact.
  return <Fragment key={hydrated ? locale : "hydrating"}>{children}</Fragment>;
}

export default OverlayProvider;
