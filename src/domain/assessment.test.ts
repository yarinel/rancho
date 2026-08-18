import { describe, expect, it } from "vitest";
import { assess, type AssessmentInput, type CatalogItemView } from "./assessment";
import { ILS } from "./types";

const CATALOG: CatalogItemView[] = [
  {
    id: "s-tube",
    internalName: "tube_regular",
    customerNameHe: "החלפת פנימית רגילה",
    priceType: "FIXED",
    basePrice: ILS(80),
    priceHigh: null,
    estDurationMin: 30,
    blockDurationMin: 40,
    instantBookEligible: true,
    active: true,
    wheelSizeConstraints: ["w20", "w24", "w26"],
  },
  {
    id: "s-brake",
    internalName: "brake_adjust",
    customerNameHe: "כיוון בלמים",
    priceType: "FIXED",
    basePrice: ILS(80),
    priceHigh: null,
    estDurationMin: 30,
    blockDurationMin: 40,
    instantBookEligible: true,
    active: true,
    wheelSizeConstraints: null,
  },
  {
    id: "s-brake-cable",
    internalName: "brake_cable",
    customerNameHe: "החלפת כבל מעצור",
    priceType: "FIXED",
    basePrice: ILS(80),
    priceHigh: null,
    estDurationMin: 30,
    blockDurationMin: 40,
    instantBookEligible: true,
    active: true,
    wheelSizeConstraints: null,
  },
  {
    id: "s-gear",
    internalName: "gear_adjust",
    customerNameHe: "כיוון הילוכים",
    priceType: "FIXED",
    basePrice: ILS(80),
    priceHigh: null,
    estDurationMin: 30,
    blockDurationMin: 40,
    instantBookEligible: true,
    active: true,
    wheelSizeConstraints: null,
  },
  {
    id: "s-tune-s",
    internalName: "tune_up_small",
    customerNameHe: "טיפול בקטנה",
    priceType: "FIXED",
    basePrice: ILS(100),
    priceHigh: null,
    estDurationMin: 40,
    blockDurationMin: 50,
    instantBookEligible: true,
    active: true,
    wheelSizeConstraints: null,
  },
  {
    id: "s-tune-f",
    internalName: "tune_up_full",
    customerNameHe: "טיפול על מלא",
    priceType: "FIXED",
    basePrice: ILS(200),
    priceHigh: null,
    estDurationMin: 60,
    blockDurationMin: 75,
    instantBookEligible: true,
    active: true,
    wheelSizeConstraints: null,
  },
];

function input(overrides: Partial<AssessmentInput>): AssessmentInput {
  return {
    symptom: "puncture",
    answers: {},
    bike: { category: "kids", wheelSize: "w20" },
    photosProvided: true,
    zoneTravelChargeKnown: true,
    catalog: CATALOG,
    ...overrides,
  };
}

describe("assessment fixtures", () => {
  it("1. classic puncture, priced wheel ⇒ HIGH fixed 80₪, instant-bookable", () => {
    const a = assess(input({ answers: { wheel: "rear", air_loss: "fast", tire_damage: "no" } }));
    expect(a.confidence).toBe("HIGH");
    expect(a.priceType).toBe("FIXED");
    expect(a.priceLow).toBe(ILS(80));
    expect(a.instantBookable).toBe(true);
  });

  it("2. puncture on 16\" kids wheel ⇒ MEDIUM range 80–110 (D2)", () => {
    const a = assess(
      input({ bike: { category: "kids", wheelSize: "w16" }, answers: { tire_damage: "no" } }),
    );
    expect(a.confidence).toBe("MEDIUM");
    expect(a.priceType).toBe("RANGE");
    expect(a.priceLow).toBe(ILS(80));
    expect(a.priceHigh).toBe(ILS(110));
    expect(a.instantBookable).toBe(true);
  });

  it("3. visible tire damage ⇒ LOW (tire pricing unresolved D1), request path", () => {
    const a = assess(input({ answers: { tire_damage: "yes" } }));
    expect(a.confidence).toBe("LOW");
    expect(a.instantBookable).toBe(false);
    expect(a.priceType).toBe("QUOTE");
  });

  it("4. weak brakes ⇒ HIGH brake adjustment 80₪", () => {
    const a = assess(input({ symptom: "brakes", answers: { which: "rear", symptom: "weak" } }));
    expect(a.confidence).toBe("HIGH");
    expect(a.expectedServiceNamesHe).toContain("כיוון בלמים");
  });

  it("5. torn cable ⇒ brake cable service", () => {
    const a = assess(input({ symptom: "brakes", answers: { symptom: "cable_torn" } }));
    expect(a.expectedServiceNamesHe).toContain("החלפת כבל מעצור");
    expect(a.confidence).toBe("HIGH");
  });

  it("6. lever reaches handlebar ⇒ MEDIUM range", () => {
    const a = assess(input({ symptom: "brakes", answers: { symptom: "lever_to_bar" } }));
    expect(a.confidence).toBe("MEDIUM");
    expect(a.priceType).toBe("RANGE");
  });

  it("7. jumping gears ⇒ HIGH gear adjustment", () => {
    const a = assess(input({ symptom: "gears", answers: { symptom: "jumping" } }));
    expect(a.confidence).toBe("HIGH");
    expect(a.expectedServiceNamesHe).toContain("כיוון הילוכים");
  });

  it("8. chain drops ⇒ MEDIUM (possible wear)", () => {
    const a = assess(input({ symptom: "chain_drops", answers: {} }));
    expect(a.confidence).toBe("MEDIUM");
  });

  it("9. Scenario B: noise/loose ⇒ LOW, no invented diagnosis, request path", () => {
    const a = assess(input({ symptom: "loose_or_noise", answers: { where: "unknown_place" } }));
    expect(a.confidence).toBe("LOW");
    expect(a.instantBookable).toBe(false);
    expect(a.expectedServiceIds).toEqual([]);
  });

  it("10. tune-up with chosen scope ⇒ HIGH fixed", () => {
    const small = assess(input({ symptom: "tune_up", answers: { scope: "small" } }));
    expect(small.priceLow).toBe(ILS(100));
    const full = assess(input({ symptom: "tune_up", answers: { scope: "full" } }));
    expect(full.priceLow).toBe(ILS(200));
    expect(full.confidence).toBe("HIGH");
  });

  it("11. tune-up undecided scope ⇒ MEDIUM range 100–200", () => {
    const a = assess(input({ symptom: "tune_up", answers: { scope: "unknown" } }));
    expect(a.confidence).toBe("MEDIUM");
    expect(a.priceLow).toBe(ILS(100));
    expect(a.priceHigh).toBe(ILS(200));
  });

  it("12. skipped photos downgrade HIGH to MEDIUM, never block", () => {
    const a = assess(
      input({ photosProvided: false, answers: { tire_damage: "no" } }),
    );
    expect(a.confidence).toBe("MEDIUM");
    expect(a.instantBookable).toBe(true);
  });

  it("13. unknown travel charge (TBD zone) caps confidence at MEDIUM", () => {
    const a = assess(
      input({ zoneTravelChargeKnown: false, answers: { tire_damage: "no" } }),
    );
    expect(a.confidence).toBe("MEDIUM");
  });

  it("14. unclassified bike category ⇒ LOW regardless of symptom", () => {
    const a = assess(
      input({ bike: { category: "other", wheelSize: "w26" }, answers: { tire_damage: "no" } }),
    );
    expect(a.confidence).toBe("LOW");
    expect(a.instantBookable).toBe(false);
  });

  it("15. inactive service in catalogue ⇒ LOW (never book an unofferable service)", () => {
    const withoutTube = CATALOG.filter((c) => c.internalName !== "tube_regular");
    const a = assess(input({ catalog: withoutTube, answers: { tire_damage: "no" } }));
    expect(a.confidence).toBe("LOW");
    expect(a.instantBookable).toBe(false);
  });

  it("16. 'I don't know' symptom ⇒ LOW request", () => {
    const a = assess(input({ symptom: "unknown" }));
    expect(a.confidence).toBe("LOW");
  });
});
