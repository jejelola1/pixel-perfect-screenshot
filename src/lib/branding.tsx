import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const brandingSchema = z.object({
  site_name: z.string().trim().min(1, "Enter a site name").max(60, "Use at most 60 characters"),
  logo_url: z.string().url().nullable(),
  theme: z.enum(["light", "dark", "system"]),
});
export type Branding = z.infer<typeof brandingSchema>;
export const defaultBranding: Branding = { site_name: "Blogs", logo_url: null, theme: "light" };
export const brandingQuery = {
  queryKey: ["site-branding"],
  queryFn: async () => {
    const { data, error } = await supabase.from("site_settings").select("site_name, logo_url, theme").eq("id", true).maybeSingle();
    if (error) throw error;
    return data ? brandingSchema.parse(data) : defaultBranding;
  },
};
const BrandingContext = createContext(defaultBranding);
export const useBranding = () => useContext(BrandingContext);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { data = defaultBranding } = useQuery(brandingQuery);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle("dark", data.theme === "dark" || (data.theme === "system" && media.matches));
      document.documentElement.style.colorScheme = data.theme === "system" ? (media.matches ? "dark" : "light") : data.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [data.theme]);
  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) {
      icon.href = data.logo_url ?? "/favicon.svg";
      icon.type = data.logo_url ? "image/png" : "image/svg+xml";
    }
  }, [data.logo_url]);
  return <BrandingContext.Provider value={data}>{children}</BrandingContext.Provider>;
}