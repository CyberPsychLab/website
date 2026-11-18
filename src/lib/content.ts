import { getCollection, getEntry } from "astro:content";

/** Site settings (src/content/site/settings.yaml). */
export async function getSite() {
  return (await getEntry("site", "settings"))!.data;
}

/** Projects, without drafts, in `order` then title order. */
export async function getProjects() {
  return (await getCollection("projects", (e) => !e.data.draft))
    .sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
}

/** Publications, without drafts, newest first. */
export async function getPublications() {
  return (await getCollection("publications", (e) => !e.data.draft))
    .sort((a, b) => b.data.year - a.data.year || a.data.title.localeCompare(b.data.title));
}

/** Posters, without drafts, newest first (by sortDate, else file name). */
export async function getPosters() {
  return (await getCollection("posters", (e) => !e.data.draft)).sort(
    (a, b) => (b.data.sortDate?.getTime() ?? 0) - (a.data.sortDate?.getTime() ?? 0) || b.id.localeCompare(a.id),
  );
}

/** People in one group, without drafts, in `order` then name order. */
export async function getPeople(group: "leadership" | "ra" | "alumni") {
  await assertProjectReferences();
  return (await getCollection("people", (e) => !e.data.draft && e.data.group === group))
    .sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name));
}

/** Astro only logs broken references; fail the build so a typo can't be merged. */
let checked = false;
async function assertProjectReferences() {
  if (checked) return;
  const ids = new Set((await getCollection("projects")).map((p) => p.id));
  const bad = (await getCollection("people")).filter((p) => p.data.project && !ids.has(p.data.project.id));
  if (bad.length) {
    throw new Error(
      bad.map((p) => `src/content/people/${p.id}.md: project "${p.data.project!.id}" does not exist. ` +
        `Use the file name of a project in src/content/projects/ (one of: ${[...ids].sort().join(", ")}).`).join("\n"),
    );
  }
  checked = true;
}
