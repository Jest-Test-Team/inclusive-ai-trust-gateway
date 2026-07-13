import type { Locale } from "@iatg/shared";

export const LOCALE_KEY = "iatg_locale";
export const LOCALE_EVENT = "iatg:locale";

export function readLocale(): Locale {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(LOCALE_KEY) === "zh-TW" ? "zh-TW" : "en";
}

export function writeLocale(locale: Locale) {
  window.localStorage.setItem(LOCALE_KEY, locale);
  // Keep the battle console key in sync for pages that still read it.
  window.localStorage.setItem("adm_lang", locale);
  window.dispatchEvent(new CustomEvent(LOCALE_EVENT, { detail: locale }));
}

export function subscribeLocale(onChange: (locale: Locale) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<Locale>).detail;
    onChange(detail === "zh-TW" ? "zh-TW" : "en");
  };
  window.addEventListener(LOCALE_EVENT, handler);
  return () => window.removeEventListener(LOCALE_EVENT, handler);
}
