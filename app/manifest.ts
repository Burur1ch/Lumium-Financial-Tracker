import type { MetadataRoute } from "next";
import { translations } from "@/store/translations";
import { quickLaunchUrl } from "@/utils/quick-launch";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lumium - Financial Tracker",
    short_name: "Lumium",
    description: "Personal finance tracking, budgets, and reports.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#090d14",
    theme_color: "#090d14",
    shortcuts: [
      { name: translations.ru.shortcutScan, short_name: translations.ru.shortcutScan,
        description: translations.ru.shortcutScanHint, url: quickLaunchUrl("scan"),
        icons: [{ src: "/shortcuts/scan.png", sizes: "96x96", type: "image/png" }] },
      { name: translations.ru.shortcutAdd, short_name: translations.ru.shortcutAdd,
        description: translations.ru.shortcutAddHint, url: quickLaunchUrl("add"),
        icons: [{ src: "/shortcuts/add.png", sizes: "96x96", type: "image/png" }] },
      { name: translations.ru.shortcutQuick, short_name: translations.ru.shortcutQuick,
        description: translations.ru.shortcutQuickHint, url: quickLaunchUrl("quick"),
        icons: [{ src: "/shortcuts/quick.png", sizes: "96x96", type: "image/png" }] },
    ],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
