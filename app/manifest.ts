import type { MetadataRoute } from "next";

// PWA Web App Manifest — emitted at /manifest.webmanifest by the App Router.
// start_url is '/' (not '/dashboard'): buyers install the marketplace too, and
// authenticated sellers are routed to their dashboard by the auth redirect flow.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sanndikaa",
    short_name: "Sanndikaa",
    description:
      "Sanndikaa — the premium multi-vendor marketplace of The Gambia. Discover and sell authentic Gambian products.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F9F8F6",
    theme_color: "#1a2e1a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
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
