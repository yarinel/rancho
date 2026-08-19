import type { MetadataRoute } from "next";

/** PWA installability — the customer surface is a home-screen app, no store. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "רנצ'ו — תיקוני אופניים עד הבית",
    short_name: "רנצ'ו",
    description: "פנצ'ר? תיקון? טיפול? שב בכייף, אנחנו בדרך.",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
