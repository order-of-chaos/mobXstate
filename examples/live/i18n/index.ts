import {
  createLocalStorage,
  type Translations,
} from "@orderofchaos/ling";

import { en } from "./translations/en";
import { pt } from "./translations/pt";
import { ru } from "./translations/ru";

export const liveNamespace = "LiveMarketing";

export const supportedLanguages = ["en", "ru", "pt"] as const;

export type PageLanguage = (typeof supportedLanguages)[number];

export const languageLabels: Record<PageLanguage, string> = {
  en: "EN",
  pt: "PT",
  ru: "RU",
};

export const translations: Record<PageLanguage, Translations> = {
  en,
  pt,
  ru,
};

export const languageStorage = createLocalStorage<PageLanguage>({
  key: "mobxstate-live-language",
});

export const isPageLanguage = (
  value: string | null | undefined,
): value is PageLanguage => {
  return supportedLanguages.some((language) => language === value);
};
