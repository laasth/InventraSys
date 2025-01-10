import { derived } from 'svelte/store';
import { languageStore } from '../stores.js';
import en from './en.js';
import no from './no.js';

const translations = {
  en,
  no
};

export const t = derived(
  languageStore,
  $language => {
    const translate = (key) => {
      const keys = key.split('.');
      let value = translations[$language];
      
      for (const k of keys) {
        if (value === undefined) return key;
        value = value[k];
      }
      
      return value || key;
    };
    
    return translate;
  }
);

export const availableLanguages = [
  { code: 'en', name: 'English' },
  { code: 'no', name: 'Norsk' }
];
