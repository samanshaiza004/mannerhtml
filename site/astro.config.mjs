import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

const base = "/mannerhtml";

export default defineConfig({
  site: "https://samanshaiza004.github.io",
  base,
  outDir: "../website-dist",
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "MannerHTML Docs",
      description: "Accessible behavior for the HTML you already have.",
      favicon: "/favicon.svg",
      logo: {
        src: "./src/assets/logo.svg",
        alt: "MannerHTML",
        replacesTitle: true,
      },
      customCss: ["./src/styles/starlight.css"],
      editLink: {
        baseUrl: "https://github.com/samanshaiza004/mannerhtml/edit/main/site/src/content/docs/",
      },
      social: [
        {
          icon: "github",
          label: "MannerHTML on GitHub",
          href: "https://github.com/samanshaiza004/mannerhtml",
        },
      ],
      sidebar: [
        {
          label: "Start",
          items: [
            { label: "Getting started", slug: "docs" },
            { label: "Live demos", link: "/demos/" },
          ],
        },
        {
          label: "Behaviors",
          items: [
            { label: "Tabs", slug: "components/tabs" },
            { label: "Form validation", slug: "components/forms" },
            { label: "Carousel", slug: "components/carousel" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Native HTML first", slug: "guides/native-html-first" },
            { label: "Accessibility", slug: "guides/accessibility" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "API", slug: "reference/api" },
            { label: "Testing evidence", slug: "reference/testing" },
          ],
        },
      ],
    }),
  ],
});
