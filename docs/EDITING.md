# Editing the CyberPsych Lab website

You don't need to know how to code. All the text, people, projects, and papers on the site are in
short text files in the `src/content/` folder. You change a file, propose the change, a maintainer
approves it, and the site updates a couple of minutes later.

## Two ways to make a change

### Option A: Ask an AI assistant (easiest)

Open this repository with an AI coding assistant such as Claude Code and describe what you want in
plain words, for example:

> Add Jane Doe as a research assistant on the ADHD project. Her bio is: "…". Her LinkedIn is …

> Move Sam Lee to alumni. He was an RA from 2024 to 2026 and is now a PhD student at NYU.

> Add this paper to publications: [paste the citation]

The assistant follows the rules in `CLAUDE.md`. It edits the right file, checks that the site
still builds, and opens a pull request for review. Read its summary of what it changed.

### Option B: Edit on github.com

1. Go to the repository on GitHub and open the `src/content/` folder.
2. **To change a file:** open it and click the pencil icon. **To add a file:** open the right folder
   (for example `people`), click **Add file → Create new file**, and paste in a template from
   `docs/templates/`.
3. Click **Commit changes…**, then **Propose changes**, then **Create pull request**.
4. Wait about a minute for the two checks at the bottom of the pull request, **Lint content** and
   **Build and check content**:
   - ✅ Both green: you're done. A maintainer will review and merge it.
   - ❌ Red: something must be fixed before merging.
   - Either way, read the **"Content check" comment** the check posts on the pull request. It lists
     every problem in the files you changed, and what to do (for example "rename to jane-doe.md").
     ⚠️ **Warnings** don't block merging, but whoever reviews will ask about them, so fix them or
     reply to the comment explaining why they're fine. Fix files on the same branch; the checks
     and the comment update automatically.

## What goes where

| I want to… | File |
|---|---|
| Change the home page text, About page, contact emails, or "Join the Lab" lists | `src/content/site/settings.yaml` |
| Add or change a research group | `src/content/projects/` (one file per project) |
| Add, update, or move a person | `src/content/people/` (one file per person) |
| Add a headshot | crop it **square** (at least 400 × 400 px), upload to `src/content/people/photos/` named like the person's file (`jane-doe.jpg`), then add `photo: "./photos/jane-doe.jpg"` |
| Add a paper | `src/content/publications/` |
| Add a poster | `src/content/posters/` |
| Upload a PDF | `public/files/papers/` or `public/files/posters/`, named like its entry, then link it as `/files/papers/2025-short-title.pdf` |

## Naming files

File names follow a few simple rules (full list: [CONTENT-RULES.md](CONTENT-RULES.md)):

- **lowercase-with-dashes**, with no spaces or capitals: `jane-doe.md`, not `Jane Doe.md`
- **people** are named after the person: `jane-doe.md`, and their photo is `photos/jane-doe.jpg`
- **papers and posters** start with the year: `2025-digital-hoarding-scale.md`
- **a PDF or image** has the same name as the entry it belongs to: `2025-digital-hoarding-scale.pdf`
- **headshots** are **square** and at least **400 × 400 px** (800 × 800 is better)
- **images** under 2 MB, **PDFs** under 20 MB

Don't worry about memorizing these. The **Lint content** check tells you exactly what to rename.

## Tips

- **Hide something without deleting it:** add `draft: true`.
- **Change the order:** smaller `order` numbers come first.
- **Quotes:** put text in double quotes, like `title: "My Title"`. If the text itself contains a
  double quote, use single quotes around it instead.
- **Lists** are lines starting with two spaces, a dash, and a space: `  - "Item"`.
- **Bios** go below the second `---` line. Leave a blank line between paragraphs. RA bios: 3–5 sentences.
- **No HTML.** Use Markdown: `**bold**`, `*italic*`, `[link text](https://…)`.
- **Survey links:** in Google Forms use **Send** → link icon, not the address of the page where you edit the form.
- **DOIs:** write them as `https://doi.org/10.…`.
- **Only publish** emails, LinkedIn profiles, and photos that the person agreed to share.
