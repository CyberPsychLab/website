#!/usr/bin/env node
/**
 * Content lint: naming and file-organization rules for src/content/ and public/files/.
 *
 * The schemas in src/content.config.ts check what's *inside* each file (required fields,
 * valid emails, real project ids). This script checks everything around it: file names,
 * which files go in which folder, matching names between related files, file sizes,
 * and leftover template text.
 *
 * Run: npm run lint              Errors fail the check; warnings are shown but don't block.
 *      npm run lint:links        Also check that web links still work (needs internet).
 * Options (used by CI):
 *   --changed <file>   list of changed paths (one per line); link checks and the
 *                      "in this pull request" section are limited to these files
 *   --links            check web links (in changed files only, if --changed is given)
 *   --report <file>    write a Markdown report (for the PR comment) to <file>,
 *                      plus counts to <file>.json
 * The rules are listed in docs/CONTENT-RULES.md. Keep the two in sync.
 */
import { readFileSync, readdirSync, statSync, existsSync, appendFileSync, writeFileSync } from "node:fs";
import { join, relative, extname, basename, dirname, posix } from "node:path";
import { parse as parseYaml } from "yaml";
import sharp from "sharp";

const ROOT = process.cwd();

const argv = process.argv.slice(2);
const option = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const next = argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
};
const REPORT_FILE = typeof option("--report") === "string" ? option("--report") : null;
const CHANGED_FILE = typeof option("--changed") === "string" ? option("--changed") : null;
const CHECK_LINKS = option("--links") !== undefined;
/** Paths changed in this pull request (null = not a PR run: everything is "in scope"). */
const changed = CHANGED_FILE && existsSync(CHANGED_FILE)
  ? new Set(readFileSync(CHANGED_FILE, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean))
  : null;
const inScope = (file) => !changed || changed.has(file);
const NOW = new Date();
const CONTENT = "src/content";
const PUBLIC_FILES = "public/files";
const MB = 1024 * 1024;
const LIMITS = { image: 2 * MB, pdf: 20 * MB };
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"];

/** Headshots in src/content/people/photos/. The site shows them as squares (180 px for
 *  leadership, 96 px for RAs, doubled on high-resolution screens). */
const PHOTO_DIR = `${CONTENT}/people/photos`;
const PHOTO = {
  minSide: 400,          // error below this (needed for sharp display at 180 px × 2)
  recommendedSide: 800,  // warning below this
  maxAspectDiff: 0.05,   // error if width/height is off square by more than 5%
};

/** Folder → what may live there. Anything not listed here is an "unexpected file". */
const FOLDERS = {
  [`${CONTENT}/site`]: { exact: ["settings.yaml"] },
  [`${CONTENT}/projects`]: { ext: [".md"] },
  [`${CONTENT}/people`]: { ext: [".md"] },
  [`${CONTENT}/people/photos`]: { ext: IMAGE_EXT },
  [`${CONTENT}/publications`]: { ext: [".md"] },
  [`${CONTENT}/posters`]: { ext: [".md"] },
  [`${CONTENT}/posters/images`]: { ext: IMAGE_EXT },
  [`${PUBLIC_FILES}/papers`]: { ext: [".pdf"] },
  [`${PUBLIC_FILES}/posters`]: { ext: [".pdf"] },
};
const IGNORED = new Set([".gitkeep", ".DS_Store", "Thumbs.db"]);
/** Instructions files allowed inside upload folders (shown when browsing the folder on GitHub). */
const FOLDER_README = "README.md";

/** Poster preview images in src/content/posters/images/. Thumbnails are shown at 4:3. */
const POSTER_IMAGE = { minWidth: 1000, aspect: 4 / 3, aspectTolerance: 0.15 };
/** Bio lengths (words) before a warning. */
const BIO = { raMax: 120, leadershipMax: 350 };
/** Hosts that block automated link checks: skipped rather than reported as broken. */
const LINK_SKIP_HOSTS = /(^|\.)linkedin\.com$/i;

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** An HTML tag (not a Markdown autolink like <https://…> or <name@x.edu>). */
const HTML_TAG = /<\/?([a-zA-Z][a-zA-Z0-9-]*)(?=[\s/>])[^>]*>/;
/** A link that runs code instead of opening a page: in a Markdown link, a YAML value, or an href. */
const SCRIPT_LINK = /(\]\(\s*<?\s*|href\s*=\s*["']?\s*|^\s*(?:-\s+|[\w-]+\s*:\s*)["']?\s*)(javascript:\S|vbscript:\S|data:[a-z]+\/)/im;
/** A DOI written any common way: 10.x/…, doi:10.x/…, http(s)://(dx.)doi.org/10.x/… */
const DOI_LOOSE = /^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/i;
const PLACEHOLDER = /\b(example entry|example bio|example ra|example alum|add a short bio|replace (this|with)|lorem ipsum|jane doe|full paper title|poster title|project name)\b/i;

const problems = [];
const report = (level, rule, file, msg, field) => problems.push({ level, rule, file, msg, field });
const error = (...a) => report("error", ...a);
const warn = (...a) => report("warning", ...a);

/* ---------------- helpers ---------------- */

const rel = (p) => relative(ROOT, p).split("\\").join("/");
/** All files and folders under dir, as { abs, path (repo-relative, forward slashes), isDir }. */
const walk = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const abs = join(dir, d.name);
    const item = { abs, path: rel(abs), isDir: d.isDirectory() };
    return item.isDir ? [item, ...walk(abs)] : [item];
  });
};
/** "Dr. Usha Barahmand, PhD" → "usha-barahmand"; "José Núñez" → "jose-nunez" */
const personSlug = (name) =>
  name
    .replace(/,.*$/, "")
    .replace(/^\s*(dr|prof|professor|mr|mrs|ms|mx)\.?\s+/i, "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const kebabHint = (stem) =>
  stem.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function readFrontMatter(file) {
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  if (file.endsWith(".yaml")) return { data: parseYaml(text) ?? {}, text, body: "" };
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error("must start with a front-matter block between two `---` lines");
  return { data: parseYaml(m[1]) ?? {}, text, body: m[2] };
}
/** Line number of `field:` in a file, for pointing GitHub annotations at the right spot. */
const lineOf = (text, field) => {
  if (!field) return 1;
  if (typeof field === "number") return field;
  const i = text.split(/\r?\n/).findIndex((l) => new RegExp(`^\\s*${field}\\s*:`).test(l));
  return i >= 0 ? i + 1 : 1;
};

/* ---------------- rule N1/N2: file names and folders ---------------- */

const allFiles = [...walk(join(ROOT, CONTENT)), ...walk(join(ROOT, PUBLIC_FILES))];
const entries = { projects: new Map(), people: new Map(), publications: new Map(), posters: new Map() };
const uploads = new Map(); // rel path → referenced?
const photos = []; // headshots to measure
const posterImages = []; // poster previews to measure

for (const { abs, path, isDir } of allFiles) {
  if (isDir) {
    if (!(path in FOLDERS))
      error("N2", path, `Unexpected folder. Content goes in one of: ${Object.keys(FOLDERS).join(", ")}.`);
    continue;
  }
  const name = posix.basename(path);
  if (IGNORED.has(name)) continue;
  if (name === FOLDER_README && path !== `${CONTENT}/${FOLDER_README}` && FOLDERS[posix.dirname(path)]?.ext?.every((x) => x !== ".md")) continue;
  const dir = posix.dirname(path);
  const ext = extname(name);
  const stem = name.slice(0, name.length - ext.length);
  const rule = FOLDERS[dir];

  if (!rule) { error("N2", path, `This file is in a folder that isn't used by the site.`); continue; }
  if (rule.exact) {
    if (!rule.exact.includes(name)) error("N2", path, `Only ${rule.exact.join(", ")} belongs in ${dir}/.`);
    continue;
  }
  if (!rule.ext.includes(ext.toLowerCase())) {
    error("N2", path, `Files in ${dir}/ must be ${rule.ext.join(" / ")}.` +
      (ext.toLowerCase() === ".docx" ? " Copy the text into a .md file instead." : ""));
    continue;
  }
  if (ext !== ext.toLowerCase() || !KEBAB.test(stem)) {
    error("N1", path, `File names use lowercase letters, numbers, and dashes only (no spaces, capitals, or underscores). ` +
      `Rename to "${kebabHint(stem) || "something-descriptive"}${ext.toLowerCase()}".`);
  }
  if (stem.length > 60) warn("N1", path, `File name is long (${stem.length} characters). Aim for 60 or fewer.`);

  // size limits
  const size = statSync(abs).size;
  const kind = ext.toLowerCase() === ".pdf" ? "pdf" : IMAGE_EXT.includes(ext.toLowerCase()) ? "image" : null;
  if (kind) {
    uploads.set(path, false);
    if (kind === "image" && dir === PHOTO_DIR) photos.push({ abs, path });
    if (kind === "image" && dir === `${CONTENT}/posters/images`) posterImages.push({ abs, path });
    if (size > LIMITS[kind])
      error("S1", path, `${(size / MB).toFixed(1)} MB is over the ${LIMITS[kind] / MB} MB limit for ${kind === "pdf" ? "PDFs" : "images"}. ` +
        (kind === "image" ? "Resize it to about 1200 px wide, or export as JPG at ~80% quality." : "Compress it (e.g. File → Reduce File Size / an online PDF compressor)."));
  }

  // parse content entries
  if (ext === ".md" || ext === ".yaml") {
    try {
      const fm = readFrontMatter(abs);
      const coll = dir.split("/")[2];
      if (coll in entries) entries[coll].set(stem, { path, ...fm });
    } catch (e) {
      error("F1", path, `Couldn't read this file: ${String(e.message).split("\n")[0]}. Check quotes, colons, and indentation.`);
    }
  }
}

/* ---------------- rule-by-collection checks ---------------- */

const at = (entry, field) => ({ file: entry.path, line: lineOf(entry.text, field) });
const markUsed = (p) => { if (uploads.has(p)) uploads.set(p, true); };
/** A local link like "/files/papers/x.pdf" → "public/files/papers/x.pdf" */
const publicPath = (link) => (typeof link === "string" && link.startsWith("/") ? posix.join("public", link) : null);
/** A relative image like "./photos/x.jpg" from src/content/people → "src/content/people/photos/x.jpg" */
const relImage = (entryPath, p) => (typeof p === "string" && p.trim() ? posix.join(posix.dirname(entryPath), p) : null);

function checkLocalLink(entry, field, expectedDir, expectedStem) {
  const p = publicPath(entry.data[field]);
  if (!p) return;
  markUsed(p);
  if (!existsSync(join(ROOT, p))) {
    error("N8", entry.path, `${field}: "${entry.data[field]}" doesn't exist. Upload the file to ${dirname(p)}/ or fix the path.`, field);
    return;
  }
  const stem = basename(p, extname(p));
  if (!p.startsWith(expectedDir + "/") || stem !== expectedStem)
    error("N7", entry.path, `${field}: name the file "${expectedDir}/${expectedStem}${extname(p)}" so it matches this entry's file name.`, field);
}
function checkImage(entry, field, expectedDir, expectedStem) {
  const p = relImage(entry.path, entry.data[field]);
  if (!p) return;
  markUsed(p);
  const stem = basename(p, extname(p));
  if (dirname(p) !== expectedDir || stem !== expectedStem)
    error("N7", entry.path, `${field}: name the image "${expectedStem}${extname(p).toLowerCase()}" in ${expectedDir}/ ` +
      `(it should match this entry's file name). Use: ${field}: "./${posix.relative(posix.dirname(entry.path), expectedDir)}/${expectedStem}${extname(p).toLowerCase()}"`, field);
}
/** 1-based line number of a character offset in text. */
const lineAt = (text, index) => text.slice(0, index).split(/\r?\n/).length;
/** Line where the Markdown body starts (after the closing ---). */
const bodyLine = (text) => {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text);
  return m ? lineAt(text, m[0].length) : 1;
};
const wordCount = (s) => (s.replace(/<!--[\s\S]*?-->/g, "").match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

/** H1: no raw HTML or script links; content is plain text and Markdown only. */
function checkMarkup(entry) {
  // Ignore HTML comments (they never render) but keep line numbers intact.
  const text = entry.text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  const tag = HTML_TAG.exec(text);
  if (tag)
    error("H1", entry.path, `HTML isn't allowed in content (found \`<${tag[1].toLowerCase()}>\`). Use plain text and Markdown instead: ` +
      "`**bold**`, `*italic*`, `[link text](https://…)`. Ask a maintainer if you need something Markdown can't do.", lineAt(text, tag.index));
  const js = SCRIPT_LINK.exec(text);
  if (js)
    error("H1", entry.path, `Links must start with https:// (or mailto:). "${js[2].split(":")[0].toLowerCase()}:" links can run code and aren't allowed.`,
      lineAt(text, js.index + js[1].length));
}

/** Links that already have an error; the link checker skips them so they aren't reported twice. */
const flaggedUrls = new Set();

/** U1: survey links must be https and, for Google Forms, the participant link (not the editor). */
function checkSurvey(entry, raw) {
  let u;
  try { u = new URL(String(raw)); } catch { return; } // schema reports invalid URLs
  const idx = entry.text.indexOf(String(raw));
  const line = idx >= 0 ? lineAt(entry.text, idx) : lineOf(entry.text, "surveys");
  if (u.protocol !== "https:") {
    flaggedUrls.add(String(raw));
    error("U1", entry.path, `Survey links must start with https:// (this one starts with ${u.protocol}//).`, line);
    return;
  }
  if (u.hostname === "docs.google.com" && u.pathname.startsWith("/forms/")
      && !/^\/forms\/d\/e\/[^/]+\/viewform\/?$/.test(u.pathname)) {
    flaggedUrls.add(String(raw));
    error("U1", entry.path, `This is the Google Form's editor link, not the link for participants. In Google Forms click ` +
      `Send → the link icon and copy that link (it looks like https://forms.gle/… or …/forms/d/e/…/viewform).`, line);
  }
}

function checkPlaceholders(entry) {
  if (entry.data.draft === true) return;
  const hit = PLACEHOLDER.exec(entry.text);
  if (hit) warn("W3", entry.path, `Looks like leftover template/placeholder text ("${hit[0]}"). Replace it, or set draft: true to hide this entry.`);
}

// Projects
for (const [id, e] of entries.projects) {
  if (id.length < 2 || id.length > 30) error("N3", e.path, `Project ids (file names) should be 2–30 characters; "${id}" is ${id.length}.`);
  for (const s of e.data.surveys ?? []) checkSurvey(e, s);
  checkMarkup(e);
  checkPlaceholders(e);
}

// People
const seenNames = new Map();
for (const [id, e] of entries.people) {
  const name = e.data.name;
  if (typeof name !== "string" || !name.trim()) continue; // schema reports missing name
  const slug = personSlug(name);
  const nameOk = new RegExp(`^${slug}(?:-\\d+)?$`).test(id);
  if (!nameOk)
    error("N4", e.path, `Person files are named after the person: rename to "${slug}.md" (from name: "${name}").`, "name");
  checkImage(e, "photo", `${CONTENT}/people/photos`, nameOk ? id : slug);
  if (typeof e.data.email === "string" && e.data.email !== e.data.email.toLowerCase())
    warn("W2", e.path, `Write email addresses in lowercase: "${e.data.email.toLowerCase()}".`, "email");
  if (e.data.draft !== true) {
    if (seenNames.has(slug)) warn("D1", e.path, `Same name as ${seenNames.get(slug)}. Is this a duplicate?`, "name");
    else seenNames.set(slug, e.path);
  }
  if (e.data.draft !== true && (e.data.group === "ra" || e.data.group === "leadership")) {
    const words = wordCount(e.body);
    const isRa = e.data.group === "ra";
    const max = isRa ? BIO.raMax : BIO.leadershipMax;
    if (words === 0)
      warn("B1", e.path, `No bio yet. Add a few sentences below the second --- line` +
        `${isRa ? " (year, major, role on the project, research interests)" : ""}.`, bodyLine(e.text));
    else if (words > max)
      warn("B1", e.path, `Bio is ${words} words; aim for ${max} or fewer` +
        `${isRa ? " (3–5 sentences) so RA cards stay a similar size" : ""}.`, bodyLine(e.text));
  }
  checkMarkup(e);
  checkPlaceholders(e);
}

// Publications
const seenTitles = new Map();
for (const [id, e] of entries.publications) {
  const year = e.data.year;
  if (Number.isInteger(year) && !id.startsWith(`${year}-`))
    error("N5", e.path, `Publication files start with the year: rename to "${year}-${id.replace(/^\d{4}-?/, "") || "short-title"}.md" (year: ${year}).`, "year");
  else if (!/^\d{4}-[a-z0-9]/.test(id))
    error("N5", e.path, `Publication files are named "<year>-<short-title>.md", e.g. "2025-digital-hoarding-scale.md".`);
  checkLocalLink(e, "pdf", `${PUBLIC_FILES}/papers`, id);
  checkLocalLink(e, "link", `${PUBLIC_FILES}/papers`, id);
  if (Number.isInteger(year) && year > NOW.getFullYear() + 1)
    warn("Y1", e.path, `year: ${year} is more than a year away. Is that a typo?`, "year");
  const rawLink = typeof e.data.link === "string" ? e.data.link.trim() : "";
  const doi = DOI_LOOSE.exec(rawLink);
  if (doi && rawLink !== `https://doi.org/${doi[1]}`)
    warn("D2", e.path, `Write DOIs as a full link: link: "https://doi.org/${doi[1]}"`, "link");
  checkMarkup(e);
  const t = String(e.data.title ?? "").toLowerCase().trim();
  if (t && e.data.draft !== true) {
    if (seenTitles.has(t)) warn("D1", e.path, `Same title as ${seenTitles.get(t)}. Is this a duplicate?`, "title");
    else seenTitles.set(t, e.path);
  }
  checkPlaceholders(e);
}

// Posters
for (const [id, e] of entries.posters) {
  const sd = e.data.sortDate;
  const year = sd instanceof Date ? sd.getUTCFullYear() : /\b(19|20)\d{2}\b/.exec(String(sd ?? e.data.date ?? ""))?.[0];
  if (year && !id.startsWith(`${year}-`))
    error("N6", e.path, `Poster files start with the year: rename to "${year}-${id.replace(/^\d{4}-?/, "") || "short-title"}.md".`, sd ? "sortDate" : "date");
  else if (!/^\d{4}-[a-z0-9]/.test(id))
    error("N6", e.path, `Poster files are named "<year>-<short-title>.md", e.g. "2026-epa-camouflaging.md".`);
  checkImage(e, "image", `${CONTENT}/posters/images`, id);
  checkLocalLink(e, "file", `${PUBLIC_FILES}/posters`, id);
  if (sd instanceof Date && sd.getTime() - NOW.getTime() > 365 * 864e5)
    warn("Y1", e.path, `sortDate is more than a year away. Is that a typo?`, "sortDate");
  checkMarkup(e);
  checkPlaceholders(e);
}

// Site settings: social images count as used
const settingsPath = `${CONTENT}/site/settings.yaml`;
if (existsSync(join(ROOT, settingsPath))) {
  try {
    const s = parseYaml(readFileSync(join(ROOT, settingsPath), "utf8")) ?? {};
    for (const soc of s.social ?? []) { const p = relImage(settingsPath, soc?.image); if (p) markUsed(p); }
    const site = { path: settingsPath, data: s, text: readFileSync(join(ROOT, settingsPath), "utf8"), body: "" };
    entries.site = new Map([["settings", site]]);
    checkMarkup(site);
  } catch (e) {
    error("F1", settingsPath, `Couldn't read settings.yaml: ${String(e.message).split("\n")[0]}`);
  }
}

/* ---------------- rule P1/P2: headshot dimensions and shape ---------------- */

for (const { abs, path } of photos) {
  let meta;
  try {
    meta = await sharp(abs).metadata();
  } catch {
    error("P1", path, "Couldn't open this image. It may be damaged or not really a JPG/PNG/WebP. Re-export it and upload again.");
    continue;
  }
  // Phones store portrait photos sideways plus a rotation flag (EXIF orientation 5–8): measure as displayed.
  const turned = (meta.orientation ?? 1) >= 5;
  const w = turned ? meta.height : meta.width, h = turned ? meta.width : meta.height;
  if (!w || !h) { error("P1", path, "Couldn't read this image's size. Re-export it and upload again."); continue; }
  const size = `${w}×${h} px`;
  const ratio = w / h;
  if (Math.abs(ratio - 1) > PHOTO.maxAspectDiff) {
    const side = Math.min(w, h);
    error("P1", path, `Headshots must be square; this one is ${size} (${w > h ? "wider than tall" : "taller than wide"}). ` +
      `Crop it to a square around the face (e.g. ${side}×${side} px) using the "Square" crop in your phone's photo editor or any image editor.`);
  }
  const short = Math.min(w, h);
  if (short < PHOTO.minSide)
    error("P2", path, `Too small: ${size}. Headshots need to be at least ${PHOTO.minSide}×${PHOTO.minSide} px (ideally ${PHOTO.recommendedSide}×${PHOTO.recommendedSide}). Ask for a larger original.`);
  else if (short < PHOTO.recommendedSide)
    warn("P2", path, `${size} is OK but will look soft on high-resolution screens. ${PHOTO.recommendedSide}×${PHOTO.recommendedSide} px or larger is recommended.`);
}

/* ---------------- rule I1: poster preview images ---------------- */

for (const { abs, path } of posterImages) {
  let meta;
  try { meta = await sharp(abs).metadata(); } catch {
    error("I1", path, "Couldn't open this image. It may be damaged or not really a JPG/PNG/WebP. Re-export it and upload again.");
    continue;
  }
  const turned = (meta.orientation ?? 1) >= 5;
  const w = turned ? meta.height : meta.width, h = turned ? meta.width : meta.height;
  if (!w || !h) continue;
  if (w < POSTER_IMAGE.minWidth)
    warn("I1", path, `${w}×${h} px is small for a poster preview. ${POSTER_IMAGE.minWidth} px wide or more keeps the text readable.`);
  const r = w / h;
  if (Math.abs(r - POSTER_IMAGE.aspect) / POSTER_IMAGE.aspect > POSTER_IMAGE.aspectTolerance)
    warn("I1", path, `Poster thumbnails are shown in a 4:3 (landscape) frame. This image is ${w}×${h} px` +
      `${r < 1 ? " (portrait)" : ""}, so its edges will be cut off. Crop a 4:3 preview (for example the title area), or accept the crop.`);
}

/* ---------------- rule L1: broken web links (opt-in: --links) ---------------- */

async function checkLinks() {
  const URL_IN_TEXT = /https?:\/\/[^\s"'<>()[\]]+[^\s"'<>()[\].,;:!?]/g;
  const uses = new Map(); // url → [{ entry, line }]
  for (const coll of Object.values(entries))
    for (const e of coll.values()) {
      if (!inScope(e.path) || e.data?.draft === true) continue;
      for (const m of e.text.matchAll(URL_IN_TEXT)) {
        let host;
        try { host = new URL(m[0]).hostname; } catch { continue; }
        if (LINK_SKIP_HOSTS.test(host) || flaggedUrls.has(m[0])) continue;
        if (!uses.has(m[0])) uses.set(m[0], []);
        uses.get(m[0]).push({ entry: e, line: lineAt(e.text, m.index) });
      }
    }
  const check = async (url) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, {
        redirect: "follow", signal: ctrl.signal,
        headers: { "user-agent": "Mozilla/5.0 (compatible; content-link-check)", accept: "text/html,*/*" },
      });
      if ([401, 403, 405, 429, 999].includes(res.status)) return null; // site blocks bots: can't tell, don't nag
      if (res.status >= 400)
        return `returns "${res.status}${res.statusText ? " " + res.statusText : ""}"${res.status === 404 || res.status === 410 ? " (page not found)" : ""}`;
      if (/docs\.google\.com\/forms|forms\.gle/.test(res.url || url) && /no longer accepting responses/i.test(await res.text()))
        return "goes to a Google Form that's no longer accepting responses";
      return null;
    } catch (err) {
      return err?.name === "AbortError" ? "didn't respond within 15 seconds" : "couldn't be reached (site down, or address mistyped?)";
    } finally { clearTimeout(timer); }
  };
  const urls = [...uses.keys()];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      const problem = await check(url);
      if (problem) for (const { entry, line } of uses.get(url)) warn("L1", entry.path, `Link ${problem}: ${url}`, line);
    }
  }));
}
if (CHECK_LINKS) await checkLinks();

// Orphaned uploads
for (const [p, used] of uploads) if (!used) warn("W1", p, `This file isn't used by any page. Link it from an entry, or delete it.`);

/* ---------------- output ---------------- */

problems.sort((a, b) => a.file.localeCompare(b.file) || (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
const errors = problems.filter((p) => p.level === "error");
const warnings = problems.filter((p) => p.level === "warning");
const lineFor = (p) => {
  if (!p.field) return 1;
  if (typeof p.field === "number") return p.field;
  try { return lineOf(readFileSync(join(ROOT, p.file), "utf8"), p.field); } catch { return 1; }
};

if (process.env.GITHUB_ACTIONS) {
  const esc = (s) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  for (const p of problems)
    console.log(`::${p.level} file=${p.file},line=${lineFor(p)},title=${esc(`Content rule ${p.rule}`)}::${esc(p.msg)}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = problems.map((p) => `| ${p.level === "error" ? "❌ error" : "⚠️ warning"} | \`${p.file}\` | ${p.rule} | ${p.msg.replace(/\|/g, "\\|")} |`);
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Content lint\n\n${problems.length ? `| | File | Rule | What to fix |\n|---|---|---|---|\n${rows.join("\n")}\n` : "All content files follow the naming rules. ✅\n"}\n` +
      `Rules: [docs/CONTENT-RULES.md](../blob/main/docs/CONTENT-RULES.md)\n`);
  }
} else {
  const c = (code, s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
  for (const p of problems)
    console.log(`${p.level === "error" ? c(31, "error  ") : c(33, "warning")} ${p.file}:${lineFor(p)}  ${c(2, p.rule)}  ${p.msg}`);
}
if (REPORT_FILE) writeReport(REPORT_FILE);

console.log(`\nContent lint: ${errors.length} error(s), ${warnings.length} warning(s). Rules: docs/CONTENT-RULES.md`);
process.exit(errors.length ? 1 : 0);

/** Markdown report for the pull-request comment (scripts/pr-comment.mjs posts it). */
function writeReport(file) {
  const repo = process.env.GITHUB_REPOSITORY;
  const sha = process.env.LINT_SHA;
  const fileCell = (p) => {
    const line = lineFor(p);
    const label = `\`${p.file}\`${line > 1 ? ` line ${line}` : ""}`;
    return repo && sha ? `[${label}](https://github.com/${repo}/blob/${sha}/${p.file}${line > 1 ? `#L${line}` : ""})` : label;
  };
  const row = (p) => `| ${p.level === "error" ? "❌" : "⚠️"} | ${fileCell(p)} | ${p.rule} | ${p.msg.replace(/\|/g, "\\|").replace(/\r?\n/g, " ")} |`;
  const table = (list) => `| | File | Rule | What to do |\n|---|---|---|---|\n${list.map(row).join("\n")}\n`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  const here = problems.filter((p) => inScope(p.file));
  const elsewhere = problems.filter((p) => !inScope(p.file));
  const errorsElsewhere = elsewhere.filter((p) => p.level === "error");
  const warningsElsewhere = elsewhere.filter((p) => p.level === "warning");
  const warningsHere = here.filter((p) => p.level === "warning");

  let md = "<!-- content-lint-report -->\n### Content check\n\n";
  if (!errors.length && !warningsHere.length) md += "✅ No problems in the files this pull request changes.\n\n";
  else {
    if (errors.length) md += `**${plural(errors.length, "error")} must be fixed before this can be merged.** `;
    if (warningsHere.length)
      md += `**${plural(warningsHere.length, "warning")}** to look at. Warnings don't block merging, but please fix them, ` +
        "or reply to this comment explaining why they're fine, before approving.";
    md += "\n\n";
    if (here.length) md += `#### In this pull request\n\n${table(here)}\n`;
    if (errorsElsewhere.length) md += `#### Errors in other files\n\n${table(errorsElsewhere)}\n`;
  }
  if (warningsElsewhere.length)
    md += `<details><summary>${plural(warningsElsewhere.length, "older warning")} in files this pull request doesn't change</summary>\n\n` +
      `${table(warningsElsewhere)}\n</details>\n\n`;
  const rules = repo ? `https://github.com/${repo}/blob/main/docs/CONTENT-RULES.md` : "docs/CONTENT-RULES.md";
  md += `<sub>Rules: [CONTENT-RULES.md](${rules}) · ${CHECK_LINKS ? "Links in changed files were checked" : "Links weren't checked"}` +
    " · This comment updates on every push.</sub>\n";

  writeFileSync(file, md);
  writeFileSync(`${file}.json`, JSON.stringify({
    errors: errors.length, warningsHere: warningsHere.length, warningsElsewhere: warningsElsewhere.length,
  }));
}
