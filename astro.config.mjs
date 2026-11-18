// @ts-check
import { defineConfig, fontProviders } from "astro/config";

// Font files live in src/assets/fonts/ (see the README there). They're served from this
// site, so visitors' browsers never contact Google, and builds don't need to download anything.
// Each font is split like Google Fonts does it: basic Latin, plus extended Latin (accented
// names), which browsers only download when a page uses one of those characters.
const LATIN = ["U+0000-00FF", "U+0131", "U+0152-0153", "U+02BB-02BC", "U+02C6", "U+02DA", "U+02DC", "U+0304", "U+0308", "U+0329", "U+2000-206F", "U+20AC", "U+2122", "U+2191", "U+2193", "U+2212", "U+2215", "U+FEFF", "U+FFFD"];
const LATIN_EXT = ["U+0100-02BA", "U+02BD-02C5", "U+02C7-02CC", "U+02CE-02D7", "U+02DD-02FF", "U+0304", "U+0308", "U+0329", "U+1D00-1DBF", "U+1E00-1E9F", "U+1EF2-1EFF", "U+2020", "U+20A0-20AB", "U+20AD-20C4", "U+2113", "U+2C60-2C7F", "U+A720-A7FF"];

/** One font file per weight range and character set. */
const variants = (/** @type {string} */ file, /** @type {string} */ weight) => [
  { src: [`./src/assets/fonts/${file}-latin.woff2`], weight, style: "normal", unicodeRange: LATIN },
  { src: [`./src/assets/fonts/${file}-latin-ext.woff2`], weight, style: "normal", unicodeRange: LATIN_EXT },
];

export default defineConfig({
  site: "https://cyberpsychlab.com",
  trailingSlash: "ignore",
  build: { format: "directory" },
  // Keep normal whitespace between inline elements (Astro 7 strips it by default).
  compressHTML: true,
  // Used in src/layouts/Base.astro (<Font />) and src/styles/global.css (--display, --body, --mono).
  fonts: [
    {
      name: "Newsreader", // headings; variable font (weight 400–600, optical size 6–72)
      cssVariable: "--font-newsreader",
      provider: fontProviders.local(),
      fallbacks: ["Georgia", "Times New Roman", "serif"],
      options: { variants: /** @type {any} */ (variants("newsreader", "400 600")) },
    },
    {
      name: "Public Sans", // body text; variable font (weight 400–700)
      cssVariable: "--font-public-sans",
      provider: fontProviders.local(),
      fallbacks: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      options: { variants: /** @type {any} */ (variants("public-sans", "400 700")) },
    },
    {
      name: "IBM Plex Mono", // labels and small caps
      cssVariable: "--font-plex-mono",
      provider: fontProviders.local(),
      fallbacks: ["ui-monospace", "Menlo", "monospace"],
      options: {
        variants: /** @type {any} */ ([...variants("ibm-plex-mono-400", "400"), ...variants("ibm-plex-mono-500", "500")]),
      },
    },
  ],
});
