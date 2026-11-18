/**
 * Content schemas — the rules every content file must follow.
 *
 * If an editor leaves out a required field, misspells a project id, or points to a
 * photo that doesn't exist, the build fails on the pull request with an error that
 * names the file and the field. Nothing broken can reach the live site.
 *
 * Content files live in src/content/<collection>/. See docs/EDITING.md.
 */
import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const url = z.string().url();
/** Optional field that also treats a blank value ("") as "not set", so editors can leave template lines empty. */
const opt = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());
/** A DOI written as 10.x/…, doi:10.x/…, or http(s)://(dx.)doi.org/10.x/…, normalized to https://doi.org/10.x/…
 *  (the content lint warns so editors write the full form next time). */
const doi = z
  .string()
  .trim()
  .regex(/^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?10\.\d{4,9}\/\S+$/i)
  .transform((v) => "https://doi.org/" + v.replace(/^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)/i, ""));
/** A web address, a DOI, an email link (mailto:), or a file in /public (starting with "/"). */
const link = z.union([doi, url, z.string().regex(/^mailto:\S+@\S+$/), z.string().regex(/^\/\S+$/)]);

/** Site-wide settings: one file, src/content/site/settings.yaml */
const site = defineCollection({
  loader: glob({ base: "./src/content/site", pattern: "*.yaml" }),
  schema: ({ image }) =>
    z.object({
      labName: z.string(),
      university: z.string(),
      universityUrl: url,
      department: z.string(),
      slogan: z.string(),
      headline: z.string(),
      intro: z.string(),
      piName: z.string(),
      piEmail: z.string().email(),
      labManagerName: z.string(),
      labManagerEmail: z.string().email(),
      applicationSubject: z.string(),
      about: z.array(z.string()).min(1),
      recentlyCompleted: z.array(z.string()).default([]),
      raDuties: z.array(z.string()).default([]),
      applicationChecklist: z.array(z.string()).default([]),
      homeProjectCount: z.number().int().min(0).default(3),
      social: z
        .array(z.object({ label: z.string(), url, image: image().optional() }))
        .default([]),
      footerLegal: z.array(z.object({ label: z.string(), url })).default([]),
      copyright: z.string(),
    }),
});

/** One file per research group: src/content/projects/<id>.md (the file name is the id). */
const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "*.md" }),
  schema: z.object({
    title: z.string(),
    order: z.number().default(100),
    status: opt(z.string()),
    methods: z.array(z.string()).default([]),
    topics: z.array(z.string()).default([]),
    /** One or more survey links. With several, each visitor is randomly assigned one. */
    surveys: z.array(url).default([]),
    draft: z.boolean().default(false),
  }),
});

/** One file per person: src/content/people/<name>.md. Bio goes below the --- lines. */
const people = defineCollection({
  loader: glob({ base: "./src/content/people", pattern: "*.md" }),
  schema: ({ image }) =>
    z
      .object({
        name: z.string(),
        group: z.enum(["leadership", "ra", "alumni"]),
        role: opt(z.string()),
        project: opt(reference("projects")),
        email: opt(z.string().email()),
        linkedin: opt(url),
        website: opt(url),
        photo: opt(image()),
        initials: opt(z.string().max(3)),
        /** Alumni only: e.g. "RA 2023–2025 · now PhD student, Example University" */
        detail: opt(z.string()),
        order: z.number().default(100),
        draft: z.boolean().default(false),
      })
      .refine((p) => p.group !== "ra" || p.project, {
        message: "Research assistants need a `project:` (the file name of a project, e.g. adhd)",
        path: ["project"],
      }),
});

/** One file per paper: src/content/publications/<year>-<short-title>.md */
const publications = defineCollection({
  loader: glob({ base: "./src/content/publications", pattern: "*.md" }),
  schema: z.object({
    title: z.string(),
    year: z.number().int().min(1990).max(2100),
    authors: z.string(),
    venue: z.string(),
    status: z.enum(["current", "past"]),
    link: opt(link),
    pdf: opt(link),
    draft: z.boolean().default(false),
  }),
});

/** One file per poster: src/content/posters/<year>-<short-title>.md */
const posters = defineCollection({
  loader: glob({ base: "./src/content/posters", pattern: "*.md" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      authors: z.string(),
      event: z.string(),
      date: z.string(),
      sortDate: z.coerce.date().optional(),
      image: opt(image()),
      file: opt(link),
      draft: z.boolean().default(false),
    }),
});

export const collections = { site, projects, people, publications, posters };
