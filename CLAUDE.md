# CyberPsych Lab website — instructions for AI assistants

This repo is the website for the CyberPsych Lab (Columbia University), served at https://cyberpsychlab.com.
It is built with Astro and deployed to GitHub Pages. Most people asking you for help are **lab members
without a technical background** who want to update content. Be plain-spoken, and confirm what you changed.

## The golden rules

1. **Content changes only touch `src/content/` and `public/files/`.** Don't edit pages, components,
   styles, config, workflows, or dependencies unless the person says they are a maintainer and asks
   for that specifically.
2. **Every change goes through a pull request.** Never push to `main` (it's protected anyway).
   Make a branch named like `content/add-jane-doe`, commit, push, and open a PR with a one-line
   summary. A maintainer reviews and merges; the site updates a couple of minutes after the merge.
3. **Run `npm run check` before opening the PR** (run `npm ci` first if `node_modules` is missing).
   It runs the naming lint (`npm run lint`) and then the build. If either fails, the message names
   the file and what to fix. Fix all errors before opening the PR, and mention any warnings in it.
4. **Follow the naming rules in `docs/CONTENT-RULES.md`.** In short: lowercase-with-dashes file names;
   people are `first-last.md`; publications and posters are `<year>-<short-title>.md`; a photo,
   poster image, or PDF has the same name as the entry it belongs to.
5. **Never invent facts.** Don't make up bios, paper titles, DOIs, dates, emails, or affiliations.
   If something is missing, ask, or leave a clear placeholder and mark the file `draft: true`.
6. **People's personal details:** only add an email, LinkedIn, or photo the person provided for
   publication. Ask about anything you're unsure of.

## Where content lives

| To change… | Edit |
|---|---|
| Home page text, About paragraphs, contacts, application checklist, RA duties, footer, social links | `src/content/site/settings.yaml` |
| A research group / project | `src/content/projects/<id>.md` (the file name is the project id) |
| A person (leadership, RA, alumni) | `src/content/people/<first-last>.md` (bio goes below the `---` block) |
| Headshots | `src/content/people/photos/<first-last>.jpg`, referenced as `photo: "./photos/<first-last>.jpg"` |
| A publication | `src/content/publications/<year>-<short-title>.md` |
| A poster | `src/content/posters/<year>-<short-title>.md`, with an optional image in `src/content/posters/images/` |
| A PDF to link to | `public/files/papers/` or `public/files/posters/`, linked as `/files/papers/name.pdf` |

Templates with every field explained are in `docs/templates/`. The full schema (required fields and
allowed values) is in `src/content.config.ts`, which is the source of truth when in doubt.

## Common tasks

- **Add an RA:** copy `docs/templates/person.md` to `src/content/people/first-last.md` (named after
  the person; a headshot goes in `photos/first-last.jpg`), set
  `group: ra` and `project:` to the file name (without `.md`) of a file in `src/content/projects/`.
- **An RA leaves:** change `group: ra` to `group: alumni` and add
  `detail: "RA 2024–2026 · now …"`. Don't delete the file unless asked.
- **Add a project:** copy `docs/templates/project.md` to `src/content/projects/<short-id>.md`.
  Ids are lowercase with dashes. Renaming a project file breaks RAs that reference it, so update them too.
- **Retire a project:** set `draft: true` (it disappears from the site; RA references still work).
  Consider adding its name to `recentlyCompleted` in `settings.yaml`.
- **Hide anything without deleting it:** `draft: true`.
- **Reorder:** lower `order` numbers appear first.

## Formatting notes

- **No HTML, ever** (rule H1): no tags, no `javascript:`/`data:` links. Markdown only. If someone
  pastes formatted text containing HTML, convert it to Markdown.
- **Survey links** must be the participant link (`forms.gle/…` or `…/forms/d/e/…/viewform`), never a
  Google Forms `/edit` link (rule U1).
- **DOIs** go in `link:` as `https://doi.org/10.…`.
- After `npm run check`, also run `npm run lint:links` and fix or mention any broken links in files
  you touched. The PR gets a "Content check" comment listing warnings; address each one (fix it or
  explain in the PR) instead of leaving it for the reviewer.
- Front matter is YAML. Wrap text in double quotes, especially if it contains `:` or `#` or starts
  with a special character. Lists are lines starting with `  - `.
- Bios and descriptions below the front matter are Markdown: blank line between paragraphs,
  `[link text](https://…)` for links.
- Images: JPG/PNG/WebP under 2 MB. Astro resizes them automatically.
- **Headshots must be square (±5%) and at least 400×400 px** (800×800 recommended). If someone gives you a
  non-square or small photo, don't upload it as-is: tell them it needs cropping or a larger original
  (you may crop it square around the face yourself only if they ask you to).

## For maintainers

- `npm run dev`: local preview at http://localhost:4321
- `npm run lint`: content naming rules (`scripts/lint-content.mjs`, documented in `docs/CONTENT-RULES.md`; keep them in sync)
- `npm run build`: production build into `dist/`
- `npm run check`: lint + build, the same checks CI runs on PRs
- Stack: Astro 7 (static output), plain CSS in `src/styles/global.css`, small inline scripts in
  components, with no UI framework. Node version is in `.nvmrc`.
- Deploy: `.github/workflows/site.yml` builds every PR and deploys `main` to GitHub Pages.
- See `docs/MAINTENANCE.md` for hosting, DNS, and dependency updates.
