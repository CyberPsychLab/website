# Fonts

The site's fonts are stored here and served from cyberpsychlab.com itself. Visitors' browsers
never contact Google or any other font service, and building the site doesn't download anything.
They're wired up in `astro.config.mjs` (`fonts`) and used through the `--display`, `--body`, and
`--mono` variables in `src/styles/global.css`.

| Font | Used for | Files | License |
|---|---|---|---|
| [Newsreader](https://fonts.google.com/specimen/Newsreader) (Production Type) | Headings | `newsreader-*.woff2`, variable: weight 400–600, optical size 6–72 | SIL Open Font License 1.1 |
| [Public Sans](https://fonts.google.com/specimen/Public+Sans) (USWDS) | Body text | `public-sans-*.woff2`, variable: weight 400–700 | SIL Open Font License 1.1 |
| [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) (IBM) | Labels, small caps | `ibm-plex-mono-<weight>-*.woff2`, weights 400 and 500 | SIL Open Font License 1.1 |

Each font is split into `-latin` (basic Latin) and `-latin-ext` (accented letters). Browsers only
download the second file when a page uses one of those characters. The files are the WOFF2 subsets
served by Google Fonts, renamed.

The SIL Open Font License lets us use, host, and redistribute these fonts freely. Full text:
https://openfontlicense.org/open-font-license-official-text/

**Changing fonts or weights** is a maintainer task: add the `.woff2` files here and update `fonts`
in `astro.config.mjs`. Content editors never need to touch this folder.
