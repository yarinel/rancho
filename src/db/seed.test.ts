import { describe, expect, it } from "vitest";
import { createTestDb } from "./test-helpers";
import { seed } from "./seed";
import * as schema from "./schema";
import { eq } from "drizzle-orm";

describe("seeds", () => {
  it("are idempotent and honor the price-verification decisions", async () => {
    const db = await createTestDb();
    await seed(db);
    await seed(db); // second run must not duplicate

    const catalog = await db.select().from(schema.serviceCatalogItems);
    expect(catalog.length).toBe(13);

    // D1: tire replacement is QUOTE and never instant-bookable
    const tire = catalog.find((c) => c.internalName === "tire_replacement")!;
    expect(tire.priceType).toBe("QUOTE");
    expect(tire.instantBookEligible).toBe(false);

    // D2: tube price constrained to the printed 20"–26" range
    const tube = catalog.find((c) => c.internalName === "tube_regular")!;
    expect(tube.basePrice).toBe(8000);
    expect(tube.wheelSizeConstraints).toEqual(["w20", "w24", "w26"]);

    // ⚠️ K#2 seeded inactive pending wording confirmation
    const sealant = catalog.find((c) => c.internalName === "tube_sealant")!;
    expect(sealant.active).toBe(false);

    // D3 flag preserved
    const cable = catalog.find((c) => c.internalName === "brake_cable")!;
    expect(cable.partIncludedTbd).toBe(true);

    const zones = await db.select().from(schema.serviceZones);
    expect(zones.map((z) => z.nameHe).sort()).toEqual(
      ["אופקים", "באר שבע", "חצרים", "כרמית", "מיתר", "עומר"].sort(),
    );
    // D5: only Be'er Sheva has a travel charge (0); others TBD (null)
    const b7 = zones.find((z) => z.nameHe === "באר שבע")!;
    expect(b7.travelCharge).toBe(0);
    expect(
      zones.filter((z) => z.nameHe !== "באר שבע").every((z) => z.travelCharge === null),
    ).toBe(true);

    const windows = await db.select().from(schema.zoneWindows);
    expect(windows.length).toBe(6 * 5); // 6 zones × Sun–Thu

    const techs = await db.select().from(schema.technicians);
    expect(techs.length).toBe(1);
    expect(techs[0].startLat).toBeTruthy(); // scheduling first-job travel anchor

    const staff = await db
      .select()
      .from(schema.staffUsers)
      .where(eq(schema.staffUsers.email, "ran@rancho.local"));
    expect(staff.length).toBe(1);
    expect(staff[0].passwordHash).toContain(":");
  });
});
