import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Limus — Trading journal & portfolio",
    short_name: "Limus",
    description: "Trading journal, portfolio tracking and performance analytics.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New trade", url: "/app/journal/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Journal", url: "/app/journal", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
