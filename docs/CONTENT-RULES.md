# Content naming rules

These rules keep the content folder tidy and predictable. Anyone (or any AI) can find a file
from a name alone, and related files line up. The **Lint content** check runs them on every
pull request, and you can run them yourself with `npm run lint`.

- ❌ **Errors** block the pull request until they're fixed.
- ⚠️ **Warnings** are shown but don't block. They point at things a reviewer should glance at.

Every message says what to rename or change. The rule code (e.g. `N4`) links back here.

## At a glance

| What | Name it | Example |
|---|---|---|
| Person | `src/content/people/<first>-<last>.md` | `people/jane-doe.md` |
| Their headshot | `src/content/people/photos/<same name>.<jpg/png/webp>`, **square**, ≥ 400 px | `people/photos/jane-doe.jpg` |
| Project | `src/content/projects/<short-id>.md` | `projects/autistic-traits.md` |
| Publication | `src/content/publications/<year>-<short-title>.md` | `publications/2025-digital-hoarding-scale.md` |
| Its PDF | `public/files/papers/<same name>.pdf` | `files/papers/2025-digital-hoarding-scale.pdf` |
| Poster | `src/content/posters/<year>-<short-title>.md` | `posters/2026-epa-camouflaging.md` |
| Its image / PDF | `src/content/posters/images/<same name>.jpg`, `public/files/posters/<same name>.pdf` | `posters/images/2026-epa-camouflaging.jpg` |

## Errors

**N1: File names are lowercase-with-dashes.** Only `a–z`, `0–9`, and `-`. No spaces,
capitals, underscores, or accents, and the extension is lowercase too (`.jpg`, not `.JPG`).
`Jane Doe.md` → `jane-doe.md`, `IMG_1234.JPG` → `jane-doe.jpg`.
*(Warning only: names over 60 characters.)*

**N2: Files go in the right folder, with the right type.**
`.md` files in `people/`, `projects/`, `publications/`, `posters/`. Images (`.jpg .jpeg .png .webp`)
in `people/photos/` and `posters/images/`. PDFs in `public/files/papers/` and `public/files/posters/`.
`src/content/site/` holds only `settings.yaml`. Upload folders may also contain a `README.md` with
instructions. No other folders. Word documents can't be used
directly: copy the text into the `.md` file.

**N3: Project ids are 2–30 characters.** The file name is the id other files use (`project: adhd`),
so keep it short and stable. Renaming a project means updating every RA that points to it.

**N4: Person files are named after the person.** First and last name from `name:`, with titles
(Dr., Prof.) and anything after a comma (", PhD") dropped, and accents removed:
`name: "Dr. José Núñez, PhD"` → `jose-nunez.md`. Two people with the same name: add `-2`.

**N5: Publication files start with the publication year.** `year: 2025` → `2025-<short-title>.md`.
Use 2–6 meaningful words from the title.

**N6: Poster files start with the year they were presented** (from `sortDate`, or the year in `date`).

**N7: Attached files share the entry's name.** A headshot, poster image, or uploaded PDF is named
exactly like the `.md` file it belongs to, so you can tell at a glance what goes with what.

**N8: Linked uploads must exist.** A `pdf:`/`file:`/`link:` starting with `/files/...` must
point at a file that's actually in `public/files/`.

**S1: Size limits.** Images up to **2 MB** (about 1200 px wide is plenty; the site resizes them
automatically). PDFs up to **20 MB**.

**P1: Headshots are square.** Width and height within 5% of each other. The site shows every
headshot as a square, so anything else gets its edges cut off. Use the "Square" crop in your phone's
photo editor (or any image editor) and keep the face centered. Phone photos are measured the way
they're displayed, so a portrait photo counts as taller than wide.

**P2: Headshots are big enough.** At least **400 × 400 px** (error below that). **800 × 800 px** or
more is recommended (warning below that), so photos stay sharp on high-resolution screens.

**F1: The file must be readable.** Usually a missing closing quote, a stray colon in unquoted text,
or a list item that isn't indented by two spaces.

## Warnings

**W1: Unused upload.** An image or PDF that no entry links to.

**W2: Email in capitals.** Write email addresses in lowercase.

**W3: Leftover placeholder text** ("Example…", "Add a short bio here", "Replace this…", template
values like "Jane Doe") in an entry that isn't a draft. Fill it in, or set `draft: true`.

**D1: Possible duplicate.** Two published people with the same name, or two papers with the same title.

---

*Field-level rules (required fields, allowed values like `group: ra`, valid emails and links, and
project references) are checked by the **Build and check content** step, using the schemas in
`src/content.config.ts`.*
