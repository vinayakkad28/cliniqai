"use client";

import { useCallback } from "react";
import { useI18nStore, type Language } from "@/lib/i18nStore";

// ─── Translation Keys ───────────────────────────────────────────────────────

type TranslationKey =
  | "dashboard"
  | "appointments"
  | "patients"
  | "consultations"
  | "billing"
  | "pharmacy"
  | "analytics"
  | "settings"
  | "queue"
  | "search"
  | "save"
  | "cancel"
  | "delete"
  | "edit"
  | "create"
  | "loading"
  | "error"
  | "success"
  | "logout"
  | "login"
  | "name"
  | "phone"
  | "email"
  | "date"
  | "time"
  | "status"
  | "doctor"
  | "patient"
  | "prescription"
  | "medicine"
  | "dose"
  | "frequency"
  | "duration"
  | "total"
  | "revenue"
  | "today"
  | "weekly"
  | "monthly"
  | "actions"
  | "no_data"
  | "confirm";

type TranslationDictionary = Record<Language, Record<TranslationKey, string>>;

// ─── Translations ────────────────────────────────────────────────────────────

const translations: TranslationDictionary = {
  en: {
    dashboard: "Dashboard",
    appointments: "Appointments",
    patients: "Patients",
    consultations: "Consultations",
    billing: "Billing",
    pharmacy: "Pharmacy",
    analytics: "Analytics",
    settings: "Settings",
    queue: "Queue",
    search: "Search",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    loading: "Loading...",
    error: "An error occurred",
    success: "Success",
    logout: "Logout",
    login: "Login",
    name: "Name",
    phone: "Phone",
    email: "Email",
    date: "Date",
    time: "Time",
    status: "Status",
    doctor: "Doctor",
    patient: "Patient",
    prescription: "Prescription",
    medicine: "Medicine",
    dose: "Dose",
    frequency: "Frequency",
    duration: "Duration",
    total: "Total",
    revenue: "Revenue",
    today: "Today",
    weekly: "Weekly",
    monthly: "Monthly",
    actions: "Actions",
    no_data: "No data available",
    confirm: "Confirm",
  },

  hi: {
    dashboard: "\u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921",
    appointments: "\u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F",
    patients: "\u092E\u0930\u0940\u091C\u093C",
    consultations: "\u092A\u0930\u093E\u092E\u0930\u094D\u0936",
    billing: "\u092C\u093F\u0932\u093F\u0902\u0917",
    pharmacy: "\u092B\u093E\u0930\u094D\u092E\u0947\u0938\u0940",
    analytics: "\u0935\u093F\u0936\u094D\u0932\u0947\u0937\u0923",
    settings: "\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938",
    queue: "\u0915\u0924\u093E\u0930",
    search: "\u0916\u094B\u091C\u0947\u0902",
    save: "\u0938\u0939\u0947\u091C\u0947\u0902",
    cancel: "\u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902",
    delete: "\u0939\u091F\u093E\u090F\u0902",
    edit: "\u0938\u0902\u092A\u093E\u0926\u093F\u0924 \u0915\u0930\u0947\u0902",
    create: "\u092C\u0928\u093E\u090F\u0902",
    loading: "\u0932\u094B\u0921 \u0939\u094B \u0930\u0939\u093E \u0939\u0948...",
    error: "\u090F\u0915 \u0924\u094D\u0930\u0941\u091F\u093F \u0939\u0941\u0908",
    success: "\u0938\u092B\u0932",
    logout: "\u0932\u0949\u0917 \u0906\u0909\u091F",
    login: "\u0932\u0949\u0917 \u0907\u0928",
    name: "\u0928\u093E\u092E",
    phone: "\u092B\u093C\u094B\u0928",
    email: "\u0908\u092E\u0947\u0932",
    date: "\u0924\u093E\u0930\u0940\u0916\u093C",
    time: "\u0938\u092E\u092F",
    status: "\u0938\u094D\u0925\u093F\u0924\u093F",
    doctor: "\u0921\u0949\u0915\u094D\u091F\u0930",
    patient: "\u092E\u0930\u0940\u091C\u093C",
    prescription: "\u0928\u0941\u0938\u094D\u0916\u093E",
    medicine: "\u0926\u0935\u093E\u0908",
    dose: "\u0916\u0941\u0930\u093E\u0915",
    frequency: "\u0906\u0935\u0943\u0924\u094D\u0924\u093F",
    duration: "\u0905\u0935\u0927\u093F",
    total: "\u0915\u0941\u0932",
    revenue: "\u0930\u093E\u091C\u0938\u094D\u0935",
    today: "\u0906\u091C",
    weekly: "\u0938\u093E\u092A\u094D\u0924\u093E\u0939\u093F\u0915",
    monthly: "\u092E\u093E\u0938\u093F\u0915",
    actions: "\u0915\u093E\u0930\u094D\u0930\u0935\u093E\u0908",
    no_data: "\u0915\u094B\u0908 \u0921\u0947\u091F\u093E \u0909\u092A\u0932\u092C\u094D\u0927 \u0928\u0939\u0940\u0902",
    confirm: "\u092A\u0941\u0937\u094D\u091F\u093F \u0915\u0930\u0947\u0902",
  },

  ta: {
    dashboard: "\u0B9A\u0BBE\u0BB3\u0BAA\u0BCD\u0BAA\u0BB2\u0B95\u0BC8",
    appointments: "\u0BA8\u0BC7\u0BB0 \u0B95\u0BC1\u0BB1\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD",
    patients: "\u0BA8\u0BCB\u0BAF\u0BBE\u0BB3\u0BBF\u0B95\u0BB3\u0BCD",
    consultations: "\u0B86\u0BB2\u0BCB\u0B9A\u0BA9\u0BC8\u0B95\u0BB3\u0BCD",
    billing: "\u0BAE\u0BBF\u0BB2\u0BCD\u0BB2\u0BBF\u0B9F\u0BB2\u0BCD",
    pharmacy: "\u0BAE\u0BB0\u0BC1\u0BA8\u0BCD\u0BA4\u0B95\u0BAE\u0BCD",
    analytics: "\u0BAA\u0B95\u0BC1\u0BAA\u0BCD\u0BAA\u0BBE\u0BAF\u0BCD\u0BB5\u0BC1",
    settings: "\u0B85\u0BAE\u0BC8\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD",
    queue: "\u0BB5\u0BB0\u0BBF\u0B9A\u0BC8",
    search: "\u0BA4\u0BC7\u0B9F\u0BC1",
    save: "\u0B9A\u0BC7\u0BAE\u0BBF",
    cancel: "\u0BB0\u0BA4\u0BCD\u0BA4\u0BC1",
    delete: "\u0BA8\u0BC0\u0B95\u0BCD\u0B95\u0BC1",
    edit: "\u0BA4\u0BBF\u0BB0\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1",
    create: "\u0B89\u0BB0\u0BC1\u0BB5\u0BBE\u0B95\u0BCD\u0B95\u0BC1",
    loading: "\u0B8F\u0BB1\u0BCD\u0BB1\u0BAE\u0BCD \u0B9A\u0BC6\u0BAF\u0BCD\u0BAF\u0BAA\u0BCD\u0BAA\u0B9F\u0BC1\u0B95\u0BBF\u0BB1\u0BA4\u0BC1...",
    error: "\u0BAA\u0BBF\u0BB4\u0BC8 \u0B8F\u0BB1\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1",
    success: "\u0BB5\u0BC6\u0BB1\u0BCD\u0BB1\u0BBF",
    logout: "\u0BB5\u0BC6\u0BB3\u0BBF\u0BAF\u0BC7\u0BB1\u0BC1",
    login: "\u0B89\u0BB3\u0BCD\u0BA8\u0BC1\u0BB4\u0BC8",
    name: "\u0BAA\u0BC6\u0BAF\u0BB0\u0BCD",
    phone: "\u0BA4\u0BCA\u0BB2\u0BC8\u0BAA\u0BCD\u0BAA\u0BC7\u0B9A\u0BBF",
    email: "\u0BAE\u0BBF\u0BA9\u0BCD\u0BA9\u0B9E\u0BCD\u0B9A\u0BB2\u0BCD",
    date: "\u0BA4\u0BC7\u0BA4\u0BBF",
    time: "\u0BA8\u0BC7\u0BB0\u0BAE\u0BCD",
    status: "\u0BA8\u0BBF\u0BB2\u0BC8",
    doctor: "\u0BAE\u0BB0\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1\u0BB5\u0BB0\u0BCD",
    patient: "\u0BA8\u0BCB\u0BAF\u0BBE\u0BB3\u0BBF",
    prescription: "\u0BAE\u0BB0\u0BC1\u0BA8\u0BCD\u0BA4\u0BC1 \u0B9A\u0BC0\u0B9F\u0BCD\u0B9F\u0BC1",
    medicine: "\u0BAE\u0BB0\u0BC1\u0BA8\u0BCD\u0BA4\u0BC1",
    dose: "\u0BAE\u0BB0\u0BC1\u0BA8\u0BCD\u0BA4\u0BB3\u0BB5\u0BC1",
    frequency: "\u0B8E\u0BA4\u0BCD\u0BA4\u0BA9\u0BC8 \u0BAE\u0BC1\u0BB1\u0BC8",
    duration: "\u0B95\u0BBE\u0BB2\u0BAE\u0BCD",
    total: "\u0BAE\u0BCA\u0BA4\u0BCD\u0BA4\u0BAE\u0BCD",
    revenue: "\u0BB5\u0BB0\u0BC1\u0BAE\u0BBE\u0BA9\u0BAE\u0BCD",
    today: "\u0B87\u0BA9\u0BCD\u0BB1\u0BC1",
    weekly: "\u0BB5\u0BBE\u0BB0\u0BBE\u0BA8\u0BCD\u0BA4\u0BBF\u0BB0\u0BAE\u0BCD",
    monthly: "\u0BAE\u0BBE\u0BA4\u0BBE\u0BA8\u0BCD\u0BA4\u0BBF\u0BB0\u0BAE\u0BCD",
    actions: "\u0B9A\u0BC6\u0BAF\u0BB2\u0BCD\u0B95\u0BB3\u0BCD",
    no_data: "\u0BA4\u0BB0\u0BB5\u0BC1 \u0B87\u0BB2\u0BCD\u0BB2\u0BC8",
    confirm: "\u0B89\u0BB1\u0BC1\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0B9F\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1",
  },

  te: {
    dashboard: "\u0C21\u0C3E\u0C37\u0C4D\u200C\u0C2C\u0C4B\u0C30\u0C4D\u0C21\u0C4D",
    appointments: "\u0C05\u0C2A\u0C3E\u0C2F\u0C3F\u0C02\u0C1F\u0C4D\u200C\u0C2E\u0C46\u0C02\u0C1F\u0C4D\u0C32\u0C41",
    patients: "\u0C30\u0C4B\u0C17\u0C41\u0C32\u0C41",
    consultations: "\u0C38\u0C02\u0C2A\u0C4D\u0C30\u0C26\u0C3F\u0C02\u0C2A\u0C41\u0C32\u0C41",
    billing: "\u0C2C\u0C3F\u0C32\u0C4D\u0C32\u0C3F\u0C02\u0C17\u0C4D",
    pharmacy: "\u0C2B\u0C3E\u0C30\u0C4D\u0C2E\u0C38\u0C40",
    analytics: "\u0C35\u0C3F\u0C36\u0C4D\u0C32\u0C47\u0C37\u0C23\u0C32\u0C41",
    settings: "\u0C38\u0C46\u0C1F\u0C4D\u0C1F\u0C3F\u0C02\u0C17\u0C4D\u200C\u0C32\u0C41",
    queue: "\u0C15\u0C4D\u0C30\u0C2E\u0C02",
    search: "\u0C35\u0C46\u0C24\u0C15\u0C02\u0C21\u0C3F",
    save: "\u0C38\u0C47\u0C35\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    cancel: "\u0C30\u0C26\u0C4D\u0C26\u0C41 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    delete: "\u0C24\u0C4A\u0C32\u0C17\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    edit: "\u0C2E\u0C3E\u0C30\u0C4D\u0C2A\u0C41 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    create: "\u0C38\u0C43\u0C37\u0C4D\u0C1F\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    loading: "\u0C32\u0C4B\u0C21\u0C4D \u0C05\u0C35\u0C41\u0C24\u0C4B\u0C02\u0C26\u0C3F...",
    error: "\u0C32\u0C4B\u0C2A\u0C02 \u0C38\u0C02\u0C2D\u0C35\u0C3F\u0C02\u0C1A\u0C3F\u0C02\u0C26\u0C3F",
    success: "\u0C35\u0C3F\u0C1C\u0C2F\u0C02",
    logout: "\u0C32\u0C3E\u0C17\u0C4D \u0C05\u0C35\u0C41\u0C1F\u0C4D",
    login: "\u0C32\u0C3E\u0C17\u0C4D \u0C07\u0C28\u0C4D",
    name: "\u0C2A\u0C47\u0C30\u0C41",
    phone: "\u0C2B\u0C4B\u0C28\u0C4D",
    email: "\u0C08\u0C2E\u0C46\u0C2F\u0C3F\u0C32\u0C4D",
    date: "\u0C24\u0C47\u0C26\u0C40",
    time: "\u0C38\u0C2E\u0C2F\u0C02",
    status: "\u0C38\u0C4D\u0C25\u0C3F\u0C24\u0C3F",
    doctor: "\u0C35\u0C48\u0C26\u0C4D\u0C2F\u0C41\u0C21\u0C41",
    patient: "\u0C30\u0C4B\u0C17\u0C3F",
    prescription: "\u0C2A\u0C4D\u0C30\u0C3F\u0C38\u0C4D\u0C15\u0C4D\u0C30\u0C3F\u0C2A\u0C4D\u0C37\u0C28\u0C4D",
    medicine: "\u0C2E\u0C02\u0C26\u0C41",
    dose: "\u0C2E\u0C4B\u0C24\u0C3E\u0C26\u0C41",
    frequency: "\u0C24\u0C30\u0C1A\u0C41\u0C26\u0C28\u0C02",
    duration: "\u0C35\u0C4D\u0C2F\u0C35\u0C27\u0C3F",
    total: "\u0C2E\u0C4A\u0C24\u0C4D\u0C24\u0C02",
    revenue: "\u0C06\u0C26\u0C3E\u0C2F\u0C02",
    today: "\u0C08\u0C30\u0C4B\u0C1C\u0C41",
    weekly: "\u0C35\u0C3E\u0C30\u0C02\u0C35\u0C3E\u0C30\u0C40",
    monthly: "\u0C28\u0C46\u0C32\u0C35\u0C3E\u0C30\u0C40",
    actions: "\u0C1A\u0C30\u0C4D\u0C2F\u0C32\u0C41",
    no_data: "\u0C21\u0C47\u0C1F\u0C3E \u0C05\u0C02\u0C26\u0C41\u0C2C\u0C3E\u0C1F\u0C41\u0C32\u0C4B \u0C32\u0C47\u0C26\u0C41",
    confirm: "\u0C28\u0C3F\u0C30\u0C4D\u0C27\u0C3E\u0C30\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
  },

  kn: {
    dashboard: "\u0CA1\u0CCD\u0CAF\u0CBE\u0CB6\u0CCD\u200C\u0CAC\u0CCB\u0CB0\u0CCD\u0CA1\u0CCD",
    appointments: "\u0C85\u0CAA\u0CBE\u0CAF\u0CBF\u0C82\u0C9F\u0CCD\u200C\u0CAE\u0CC6\u0C82\u0C9F\u0CCD\u200C\u0C97\u0CB3\u0CC1",
    patients: "\u0CB0\u0CCB\u0C97\u0CBF\u0C97\u0CB3\u0CC1",
    consultations: "\u0CB8\u0CAE\u0CBE\u0CB2\u0CCB\u0C9A\u0CA8\u0CC6\u0C97\u0CB3\u0CC1",
    billing: "\u0CAC\u0CBF\u0CB2\u0CCD\u0CB2\u0CBF\u0C82\u0C97\u0CCD",
    pharmacy: "\u0CAB\u0CBE\u0CB0\u0CCD\u0CAE\u0CB8\u0CBF",
    analytics: "\u0CB5\u0CBF\u0CB6\u0CCD\u0CB2\u0CC7\u0CB7\u0CA3\u0CC6",
    settings: "\u0CB8\u0CC6\u0C9F\u0CCD\u0C9F\u0CBF\u0C82\u0C97\u0CCD\u200C\u0C97\u0CB3\u0CC1",
    queue: "\u0C95\u0CCD\u0CB0\u0CAE",
    search: "\u0CB9\u0CC1\u0CA1\u0CC1\u0C95\u0CBF",
    save: "\u0C89\u0CB3\u0CBF\u0CB8\u0CBF",
    cancel: "\u0CB0\u0CA6\u0CCD\u0CA6\u0CC1\u0CAE\u0CBE\u0CA1\u0CBF",
    delete: "\u0C85\u0CB3\u0CBF\u0CB8\u0CBF",
    edit: "\u0CB8\u0C82\u0CAA\u0CBE\u0CA6\u0CBF\u0CB8\u0CBF",
    create: "\u0CB0\u0C9A\u0CBF\u0CB8\u0CBF",
    loading: "\u0CB2\u0CCB\u0CA1\u0CCD \u0C86\u0C97\u0CC1\u0CA4\u0CCD\u0CA4\u0CBF\u0CA6\u0CC6...",
    error: "\u0CA6\u0CCB\u0CB7 \u0CB8\u0C82\u0CAD\u0CB5\u0CBF\u0CB8\u0CBF\u0CA6\u0CC6",
    success: "\u0CAF\u0CB6\u0CB8\u0CCD\u0CB8\u0CC1",
    logout: "\u0CB2\u0CBE\u0C97\u0CCD \u0C94\u0C9F\u0CCD",
    login: "\u0CB2\u0CBE\u0C97\u0CCD \u0C87\u0CA8\u0CCD",
    name: "\u0CB9\u0CC6\u0CB8\u0CB0\u0CC1",
    phone: "\u0CAB\u0CCB\u0CA8\u0CCD",
    email: "\u0C87\u0CAE\u0CC7\u0CB2\u0CCD",
    date: "\u0CA6\u0CBF\u0CA8\u0CBE\u0C82\u0C95",
    time: "\u0CB8\u0CAE\u0CAF",
    status: "\u0CB8\u0CCD\u0CA5\u0CBF\u0CA4\u0CBF",
    doctor: "\u0CB5\u0CC8\u0CA6\u0CCD\u0CAF\u0CB0\u0CC1",
    patient: "\u0CB0\u0CCB\u0C97\u0CBF",
    prescription: "\u0C94\u0CB7\u0CA7 \u0C9A\u0CC0\u0C9F\u0CBF",
    medicine: "\u0C94\u0CB7\u0CA7",
    dose: "\u0CAA\u0CCD\u0CB0\u0CAE\u0CBE\u0CA3",
    frequency: "\u0C86\u0CB5\u0CB0\u0CCD\u0CA4\u0CA8",
    duration: "\u0C85\u0CB5\u0CA7\u0CBF",
    total: "\u0C92\u0C9F\u0CCD\u0C9F\u0CC1",
    revenue: "\u0C86\u0CA6\u0CBE\u0CAF",
    today: "\u0C87\u0C82\u0CA6\u0CC1",
    weekly: "\u0CB5\u0CBE\u0CB0\u0CA6",
    monthly: "\u0CAE\u0CBE\u0CB8\u0CBF\u0C95",
    actions: "\u0C95\u0CCD\u0CB0\u0CBF\u0CAF\u0CC6\u0C97\u0CB3\u0CC1",
    no_data: "\u0CA1\u0CC7\u0C9F\u0CBE \u0CB2\u0CAD\u0CCD\u0CAF\u0CB5\u0CBF\u0CB2\u0CCD\u0CB2",
    confirm: "\u0CA6\u0CC3\u0CA2\u0CC0\u0C95\u0CB0\u0CBF\u0CB8\u0CBF",
  },
};

// ─── Translation function ────────────────────────────────────────────────────

/**
 * Get a translated string for the given key and language.
 * Falls back to English if the key is missing in the target language.
 */
export function t(key: TranslationKey, language: Language = "en"): string {
  return translations[language]?.[key] ?? translations.en[key] ?? key;
}

// ─── React hook ──────────────────────────────────────────────────────────────

/**
 * React hook that returns a `t` function bound to the current language
 * from the Zustand i18n store.
 *
 * Usage:
 *   const { t, language, setLanguage } = useTranslation();
 *   <h1>{t("dashboard")}</h1>
 */
export function useTranslation() {
  const { language, setLanguage } = useI18nStore();

  const translate = useCallback(
    (key: TranslationKey) => t(key, language),
    [language]
  );

  return {
    t: translate,
    language,
    setLanguage,
  };
}

export type { TranslationKey, Language };
