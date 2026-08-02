import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nexcgen — Loans Management",
    short_name: "Nexcgen",
    description:
      "Enterprise-grade loan and savings management system for SACCOs, MFIs, and cooperative societies.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F4F3",
    theme_color: "#2F6FE4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
