import { describe, expect, it } from "vitest";
import { brandingSchema } from "@/lib/branding";

describe("Site branding", () => {
  it("accepts an admin-provided site name and uploaded logo", () => {
    expect(brandingSchema.parse({ site_name: " Faro Quest ", logo_url: "https://example.org/logo.png", theme: "dark" }).site_name).toBe("Faro Quest");
    expect(brandingSchema.safeParse({ site_name: " ", logo_url: null, theme: "light" }).success).toBe(false);
  });
  it("allows light, dark and system themes only", () => {
    for (const theme of ["light", "dark", "system"]) expect(brandingSchema.safeParse({ site_name: "Blogs", logo_url: null, theme }).success).toBe(true);
    expect(brandingSchema.safeParse({ site_name: "Blogs", logo_url: null, theme: "invalid" }).success).toBe(false);
  });
});