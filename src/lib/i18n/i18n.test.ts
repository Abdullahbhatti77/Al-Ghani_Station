import { describe, expect, it } from "vitest";
import { en } from "./en";
import { ur } from "./ur";

describe("translations", () => {
  it("Roman Urdu has exactly the same keys as English", () => {
    expect(Object.keys(ur).sort()).toEqual(Object.keys(en).sort());
  });
  it("no dictionary contains Urdu/Arabic script", () => {
    const arabic = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
    for (const v of [...Object.values(en), ...Object.values(ur)]) expect(arabic.test(v)).toBe(false);
  });
  it("uses the agreed Roman Urdu terms", () => {
    expect(ur["nav.dashboard"]).toBe("Aaj ka Khulasa");
    expect(ur["common.save"]).toBe("Mehfooz Karein");
    expect(ur["common.cancel"]).toBe("Wapas");
    expect(ur["nav.expenses"]).toBe("Kharchay");
    expect(ur["nav.fuelStock"]).toBe("Fuel ka Stock");
  });
});
