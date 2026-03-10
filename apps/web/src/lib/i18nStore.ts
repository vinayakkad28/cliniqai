import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'en' | 'hi' | 'ta' | 'te' | 'kn';

interface I18nState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'cliniqai-language',
    }
  )
);
