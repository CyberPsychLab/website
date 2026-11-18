#!/usr/bin/env node
/**
 * Posts the content-lint report as ONE comment on the pull request, and edits that same
 * comment on later pushes (so the PR doesn't fill up with bot comments).
 *
 *   node scripts/pr-comment.mjs <report.md>            (in GitHub Actions)
 *   node scripts/pr-comment.mjs <report.md> --dry-run  (prints what it would do)
 *
 * Needs GITHUB_TOKEN (pull-requests: write), GITHUB_REPOSITORY, PR_NUMBER.
 * Posts a new comment only when there's something to report; if a comment already exists
 * it's always updated (so it flips to "no problems" once things are fixed).
 */
import { readFileSync, existsSync } from "node:fs";

const MARKER = "<!-- content-lint-report -->";
const [file, flag] = process.argv.slice(2);
const dryRun = flag === "--dry-run";
if (!file || !existsSync(file)) {
  console.log(`No report at ${file}; nothing to post.`);
  process.exit(0);
}
const body = readFileSync(file, "utf8");
const counts = existsSync(`${file}.json`) ? JSON.parse(readFileSync(`${file}.json`, "utf8")) : { errors: 1, warningsHere: 1 };
const worthPosting = counts.errors > 0 || counts.warningsHere > 0;

const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, PR_NUMBER: pr } = process.env;
if (dryRun || !token || !repo || !pr) {
  console.log(`[dry run] would ${worthPosting ? "post or update" : "only update an existing"} the PR comment:\n\n${body}`);
  process.exit(0);
}

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

let existing = null;
for (let page = 1; page <= 10 && !existing; page++) {
  const list = await api(`/issues/${pr}/comments?per_page=100&page=${page}`);
  existing = list.find((c) => c.user?.type === "Bot" && c.body?.includes(MARKER)) ?? null;
  if (list.length < 100) break;
}

if (existing) {
  await api(`/issues/comments/${existing.id}`, { method: "PATCH", body: JSON.stringify({ body }) });
  console.log(`Updated comment ${existing.html_url}`);
} else if (worthPosting) {
  const c = await api(`/issues/${pr}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  console.log(`Posted comment ${c.html_url}`);
} else {
  console.log("No problems in this pull request; no comment needed.");
}
