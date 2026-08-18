import type {
  BicycleCategory,
  Confidence,
  SymptomCategory,
  WheelSize,
} from "./types";
import { ILS, PRICED_WHEEL_SIZES } from "./types";

/**
 * Deterministic pre-diagnosis (docs/PRODUCT.md §assessment).
 * No AI, no guessing dressed as fact: every branch is a business rule and the
 * rationale is recorded for the operator. LOW confidence always routes to a
 * Service Request — ambiguity never instant-books (non-negotiable).
 */

export interface CatalogItemView {
  id: string;
  internalName: string;
  customerNameHe: string;
  priceType: string;
  basePrice: number | null;
  priceHigh: number | null;
  estDurationMin: number;
  blockDurationMin: number;
  instantBookEligible: boolean;
  active: boolean;
  wheelSizeConstraints: string[] | null;
}

export interface AssessmentInput {
  symptom: SymptomCategory;
  answers: Record<string, string>;
  bike: {
    category: BicycleCategory;
    wheelSize: WheelSize;
  };
  photosProvided: boolean;
  zoneTravelChargeKnown: boolean;
  catalog: CatalogItemView[];
}

export interface Assessment {
  expectedServiceIds: string[];
  expectedServiceNamesHe: string[];
  durationEstMin: number;
  blockDurationMin: number;
  priceType: "FIXED" | "RANGE" | "QUOTE";
  priceLow: number | null; // agorot
  priceHigh: number | null;
  confidence: Confidence;
  rationale: string;
  instantBookable: boolean;
}

const FALLBACK_RANGE = { low: ILS(80), high: ILS(110) }; // D2 default

function find(catalog: CatalogItemView[], name: string) {
  return catalog.find((c) => c.internalName === name && c.active) ?? null;
}

function downgrade(c: Confidence): Confidence {
  return c === "HIGH" ? "MEDIUM" : c;
}

export function assess(input: AssessmentInput): Assessment {
  const { symptom, answers, bike, catalog } = input;
  const notes: string[] = [];

  let confidence: Confidence = "LOW";
  let service: CatalogItemView | null = null;
  let priceType: Assessment["priceType"] = "QUOTE";
  let priceLow: number | null = null;
  let priceHigh: number | null = null;

  switch (symptom) {
    case "puncture": {
      if (answers.tire_damage === "yes") {
        confidence = "LOW";
        notes.push("נזק נראה לעין בצמיג — ייתכן שנדרשת החלפת צמיג (מחיר TBD, D1)");
        break;
      }
      service = find(catalog, "tube_regular");
      if (!service) {
        notes.push("שירות פנימית אינו פעיל בקטלוג");
        break;
      }
      const sizeCovered =
        PRICED_WHEEL_SIZES.includes(bike.wheelSize) &&
        (!service.wheelSizeConstraints ||
          service.wheelSizeConstraints.includes(bike.wheelSize));
      if (sizeCovered && service.basePrice != null) {
        confidence = "HIGH";
        priceType = "FIXED";
        priceLow = service.basePrice;
        priceHigh = service.basePrice;
        notes.push("פנצ'ר קלאסי בגודל גלגל מתומחר");
      } else {
        confidence = "MEDIUM";
        priceType = "RANGE";
        priceLow = FALLBACK_RANGE.low;
        priceHigh = FALLBACK_RANGE.high;
        notes.push(
          `גודל גלגל ${bike.wheelSize} מחוץ לטבלת המחירון (20\"–26\") — טווח משוער (D2)`,
        );
      }
      break;
    }

    case "brakes": {
      if (answers.symptom === "cable_torn") {
        service = find(catalog, "brake_cable");
        notes.push("כבל קרוע מדווח — החלפת כבל מעצור");
      } else {
        service = find(catalog, "brake_adjust");
        notes.push("כיוון בלמים");
      }
      if (!service) break;
      if (answers.symptom === "lever_to_bar" || answers.symptom === "unknown") {
        confidence = "MEDIUM";
        priceType = "RANGE";
        priceLow = service.basePrice ?? FALLBACK_RANGE.low;
        priceHigh = Math.max(
          (service.basePrice ?? FALLBACK_RANGE.low) + ILS(30),
          FALLBACK_RANGE.high,
        );
        notes.push("ייתכן צורך בכבל/רפידות — נדע בדיוק אחרי בדיקה");
      } else {
        confidence = "HIGH";
        priceType = "FIXED";
        priceLow = service.basePrice;
        priceHigh = service.basePrice;
      }
      break;
    }

    case "gears":
    case "chain_drops": {
      service = find(catalog, "gear_adjust");
      if (!service) break;
      if (symptom === "gears" && answers.symptom === "jumping") {
        confidence = "HIGH";
        priceType = "FIXED";
        priceLow = service.basePrice;
        priceHigh = service.basePrice;
        notes.push("הילוכים קופצים — כיוון הילוכים");
      } else {
        confidence = "MEDIUM";
        priceType = "RANGE";
        priceLow = service.basePrice ?? FALLBACK_RANGE.low;
        priceHigh = Math.max(
          (service.basePrice ?? FALLBACK_RANGE.low) + ILS(30),
          FALLBACK_RANGE.high,
        );
        notes.push("שרשרת נופלת / תיאור חלקי — ייתכן בלאי, נאשר בבדיקה");
      }
      break;
    }

    case "tune_up": {
      const scope = answers.scope;
      if (scope === "small" || scope === "full") {
        service = find(
          catalog,
          scope === "small" ? "tune_up_small" : "tune_up_full",
        );
        if (service && service.basePrice != null) {
          confidence = "HIGH";
          priceType = "FIXED";
          priceLow = service.basePrice;
          priceHigh = service.basePrice;
          notes.push("טיפול בהיקף שנבחר על ידי הלקוח");
        }
      } else {
        confidence = "MEDIUM";
        const small = find(catalog, "tune_up_small");
        const full = find(catalog, "tune_up_full");
        if (small?.basePrice != null && full?.basePrice != null) {
          service = small;
          priceType = "RANGE";
          priceLow = small.basePrice;
          priceHigh = full.basePrice;
          notes.push("היקף הטיפול ייקבע אצלכם — טווח בין שני הטיפולים");
        }
      }
      break;
    }

    case "loose_or_noise":
    case "unknown": {
      confidence = "LOW";
      notes.push("תסמין לא חד-משמעי — נדרשת הצצה של רן לפני תמחור");
      break;
    }
  }

  // bikes we can't classify get a human look, never an instant booking
  if (bike.category === "other") {
    confidence = "LOW";
    notes.push("סוג אופניים לא מסווג — בדיקת התאמה ידנית");
  }

  if (!input.photosProvided && confidence === "HIGH") {
    confidence = downgrade(confidence);
    notes.push("ללא תמונות — רמת ביטחון ירדה");
  }

  if (!input.zoneTravelChargeKnown && confidence === "HIGH") {
    confidence = "MEDIUM";
    notes.push("תוספת הגעה לאזור טרם נקבעה (D5) — נאשר סופית בתיאום");
  }

  const instantBookable =
    confidence !== "LOW" && !!service && service.instantBookEligible;

  if (confidence === "LOW" || !service) {
    return {
      expectedServiceIds: service ? [service.id] : [],
      expectedServiceNamesHe: service ? [service.customerNameHe] : [],
      durationEstMin: service?.estDurationMin ?? 30,
      blockDurationMin: service?.blockDurationMin ?? 40,
      priceType: "QUOTE",
      priceLow: null,
      priceHigh: null,
      confidence: "LOW",
      rationale: notes.join("; "),
      instantBookable: false,
    };
  }

  return {
    expectedServiceIds: [service.id],
    expectedServiceNamesHe: [service.customerNameHe],
    durationEstMin: service.estDurationMin,
    blockDurationMin: service.blockDurationMin,
    priceType,
    priceLow,
    priceHigh,
    confidence,
    rationale: notes.join("; "),
    instantBookable,
  };
}
