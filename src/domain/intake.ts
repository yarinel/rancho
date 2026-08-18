import type { SymptomCategory } from "./types";

/**
 * Guided intake — versioned question definitions (schema_version 1).
 * Customer language first: chips, not mechanic terminology. Shared by the
 * booking wizard (rendering) and the assessment engine (interpretation).
 */

export const INTAKE_SCHEMA_VERSION = 1;

export interface IntakeOption {
  value: string;
  labelHe: string;
}

export interface IntakeQuestion {
  key: string;
  labelHe: string;
  options: IntakeOption[];
}

const DONT_KNOW: IntakeOption = { value: "unknown", labelHe: "לא יודע" };

export const SYMPTOM_LABELS: Record<SymptomCategory, string> = {
  puncture: "יש פנצ'ר / הגלגל ריק",
  brakes: "הבלמים לא עובדים טוב",
  gears: "ההילוכים לא עובדים טוב",
  chain_drops: "השרשרת נופלת",
  loose_or_noise: "משהו רופף או מרעיש",
  tune_up: "צריך טיפול כללי",
  unknown: "אני לא יודע מה הבעיה",
};

export const INTAKE_QUESTIONS: Record<SymptomCategory, IntakeQuestion[]> = {
  puncture: [
    {
      key: "wheel",
      labelHe: "איזה גלגל?",
      options: [
        { value: "front", labelHe: "קדמי" },
        { value: "rear", labelHe: "אחורי" },
        DONT_KNOW,
      ],
    },
    {
      key: "air_loss",
      labelHe: "האוויר יורד לאט או מיד?",
      options: [
        { value: "slow", labelHe: "לאט, תוך יום-יומיים" },
        { value: "fast", labelHe: "מיד" },
        DONT_KNOW,
      ],
    },
    {
      key: "tire_damage",
      labelHe: "רואים נזק בצמיג עצמו (קרע, בלאי חזק)?",
      options: [
        { value: "yes", labelHe: "כן" },
        { value: "no", labelHe: "לא" },
        DONT_KNOW,
      ],
    },
  ],
  brakes: [
    {
      key: "which",
      labelHe: "איזה בלם?",
      options: [
        { value: "front", labelHe: "קדמי" },
        { value: "rear", labelHe: "אחורי" },
        { value: "both", labelHe: "שניהם" },
        DONT_KNOW,
      ],
    },
    {
      key: "symptom",
      labelHe: "מה מרגישים?",
      options: [
        { value: "weak", labelHe: "בלימה חלשה" },
        { value: "rubbing", labelHe: "משפשף תוך כדי רכיבה" },
        { value: "lever_to_bar", labelHe: "הידית מגיעה עד הכידון" },
        { value: "cable_torn", labelHe: "רואים כבל קרוע / משוחרר" },
        DONT_KNOW,
      ],
    },
  ],
  gears: [
    {
      key: "symptom",
      labelHe: "מה קורה?",
      options: [
        { value: "jumping", labelHe: "ההילוכים קופצים לבד" },
        { value: "not_shifting", labelHe: "לא עוברים הילוך" },
        { value: "chain_drops", labelHe: "השרשרת נופלת" },
        DONT_KNOW,
      ],
    },
  ],
  chain_drops: [
    {
      key: "frequency",
      labelHe: "כל כמה זמן זה קורה?",
      options: [
        { value: "always", labelHe: "כל רכיבה" },
        { value: "sometimes", labelHe: "מדי פעם" },
        DONT_KNOW,
      ],
    },
  ],
  loose_or_noise: [
    {
      key: "where",
      labelHe: "מאיפה זה מגיע, בערך?",
      options: [
        { value: "handlebar", labelHe: "כידון / היגוי" },
        { value: "wheels", labelHe: "גלגלים" },
        { value: "pedals", labelHe: "פדלים / קראנק" },
        { value: "unknown_place", labelHe: "קשה להגיד" },
        DONT_KNOW,
      ],
    },
  ],
  tune_up: [
    {
      key: "scope",
      labelHe: "איזה טיפול?",
      options: [
        { value: "small", labelHe: "טיפול בקטנה — כיוונים, ברגים ואוויר" },
        { value: "full", labelHe: "טיפול על מלא — כולל ניקוי ושימון שרשרת" },
        { value: "unknown", labelHe: "תגידו אתם אחרי שתראו" },
      ],
    },
  ],
  unknown: [],
};
