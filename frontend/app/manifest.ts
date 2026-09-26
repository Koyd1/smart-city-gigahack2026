import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CIVIS — Asistent municipal digital",
    short_name: "CIVIS",
    description: "Informații municipale bazate pe documente publice",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f8fb",
    theme_color: "#087dbb",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
  };
}
