import { describe, expect, it } from "vitest";
import { canChangeAdminRole, csvCell } from "@/lib/admin-rules";

describe("Admin role management", () => {
  it("protects the administrator's own access", () => {
    expect(canChangeAdminRole("owner", "owner", false)).toBe(false);
    expect(canChangeAdminRole("owner", "other", false)).toBe(true);
    expect(canChangeAdminRole("owner", "other", true)).toBe(true);
  });
  it("exports subscriber values without spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"bad\")")).toBe('"\'=HYPERLINK(""bad"")"');
    expect(csvCell("reader@example.org")).toBe('"reader@example.org"');
  });
});