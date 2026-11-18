#!/usr/bin/env node
/**
 * Content lint: naming and file-organization rules for src/content/ and public/files/.
 *
 * The schemas in src/content.config.ts check what's *inside* each file (required fields,
 * valid emails, real project ids). This script checks everything around it: file names,
 * which files go in which folder, matching names between related files, file sizes,
 * and leftover template text.
 *
 * Run: npm run lint        Errors fail the check; warnings are shown but don't block.
 * The rules are listed in docs/CONTENT-RULES.md. Keep the two in sync.
 */
import { readFileSync, readdirSync, statSync, existsSync, appendFileSync } from "node:fs";
import { join, relative, extname, basename, dirname, posix } from "node:path";
import { parse as parseYaml } from "yaml";
import sharp from "sharp";

const ROOT = process.cwd();
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

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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
  const i = text.split(/\r?\n/).findIndex((l) => new RegExp(`^\\s*${field}\\s*:`).test(l));
  return i >= 0 ? i + 1 : 1;
};

/* ---------------- rule N1/N2: file names and folders ---------------- */

const allFiles = [...walk(join(ROOT, CONTENT)), ...walk(join(ROOT, PUBLIC_FILES))];
const entries = { projects: new Map(), people: new Map(), publications: new Map(), posters: new Map() };
const uploads = new Map(); // rel path → referenced?
const photos = []; // headshots to measure

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
function checkPlaceholders(entry) {
  if (entry.data.draft === true) return;
  const hit = PLACEHOLDER.exec(entry.text);
  if (hit) warn("W3", entry.path, `Looks like leftover template/placeholder text ("${hit[0]}"). Replace it, or set draft: true to hide this entry.`);
}

// Projects
for (const [id, e] of entries.projects) {
  if (id.length < 2 || id.length > 30) error("N3", e.path, `Project ids (file names) should be 2–30 characters; "${id}" is ${id.length}.`);
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
  checkPlaceholders(e);
}

// Site settings: social images count as used
const settingsPath = `${CONTENT}/site/settings.yaml`;
if (existsSync(join(ROOT, settingsPath))) {
  try {
    const s = parseYaml(readFileSync(join(ROOT, settingsPath), "utf8")) ?? {};
    for (const soc of s.social ?? []) { const p = relImage(settingsPath, soc?.image); if (p) markUsed(p); }
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

// Orphaned uploads
for (const [p, used] of uploads) if (!used) warn("W1", p, `This file isn't used by any page. Link it from an entry, or delete it.`);

/* ---------------- output ---------------- */

problems.sort((a, b) => a.file.localeCompare(b.file) || (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
const errors = problems.filter((p) => p.level === "error");
const warnings = problems.filter((p) => p.level === "warning");
const lineFor = (p) => {
  if (!p.field) return 1;
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
console.log(`\nContent lint: ${errors.length} error(s), ${warnings.length} warning(s). Rules: docs/CONTENT-RULES.md`);
process.exit(errors.length ? 1 : 0);
