import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Locale = "en" | "zh" | "pt";

export type LocaleState = {
  locale: Locale;
  hydrated: boolean;
  setLocale: (locale: Locale) => void;
  hydrate: () => Promise<void> | void;
};

export const useLocale = create<LocaleState>()(
  persist(
    (set, _get, api) => ({
      locale: "en",
      hydrated: false,
      setLocale: (locale: Locale) => set({ locale }),
      hydrate: (): Promise<void> | void => {
        const res = api.persist.rehydrate();
        if (res && typeof res.then === "function") {
          return res.then(() => {
            set({ hydrated: true });
          });
        }
        set({ hydrated: true });
      },
    }),
    {
      name: "artex-locale",
      skipHydration: true,
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {
            // No-op in non-browser environments
          },
          removeItem: () => {
            // No-op in non-browser environments
          },
        };
      }),
      partialize: (state) => ({ locale: state.locale }) as LocaleState,
      onRehydrateStorage: () => (_state, error) => {
        if (!error) {
          useLocale.setState({ hydrated: true });
        }
      },
    },
  ),
);

export const hydrate = () => useLocale.getState().hydrate();
