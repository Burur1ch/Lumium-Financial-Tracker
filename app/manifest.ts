import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lumium - Financial Tracker",
    short_name: "Lumium",
    description: "Personal finance tracking, budgets, and reports.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f6f8",
    theme_color: "#ef4444",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
