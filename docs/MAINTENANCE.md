# Maintenance guide

Technical notes for whoever maintains the site (hosting, DNS, dependencies, code).

## Stack

- **Astro 7**, static output. No server and no database. Content is checked against the schemas in
  `src/content.config.ts` at build time, and `src/lib/content.ts` adds a hard failure for broken
  project references (by default Astro only logs those).
- Plain CSS (`src/styles/global.css`) and small inline `<script>`s in components, with no UI framework.
- Node version: `.nvmrc`. Dependency versions are pinned exactly in `package.json` and locked in
  `package-lock.json`.

## Commands

```bash
npm ci            # install exactly what's in the lockfile
npm run dev       # local preview at http://localhost:4321
npm run lint      # content naming rules (docs/CONTENT-RULES.md)
npm run build     # production build into dist/
npm run check     # lint + build, the same checks CI runs on every PR
npm run preview   # serve the built dist/ folder
```

## GitHub setup (one time)

1. **Repository:** `CyberPsychLab/website`, default branch `main`.
2. **Pages:** Settings → Pages → *Build and deployment* → Source: **GitHub Actions**.
   Custom domain: `cyberpsychlab.com`. Tick **Enforce HTTPS** once it becomes available (can take up to 24 h).
   No `CNAME` file is needed. With an Actions deploy, GitHub ignores it.
3. **Verify the domain for the org:** Org settings → Pages → **Add a domain** → `cyberpsychlab.com`, then
   add the TXT record GitHub shows (see DNS below). This stops other GitHub accounts from claiming
   the domain or its subdomains. Keep the TXT record in place permanently.
4. **Protect `main`** with the repository ruleset **Protect main** (Settings → Rules → Rulesets):
   - Require a pull request before merging, with 1 approval and review from Code Owners (squash merge only)
   - Require the status checks **Lint content** and **Build and check content** to pass
   - Block force pushes and deletions
   - **Bypass list: Organization admin (org owners) only, mode "Always".** The maintainer is the only
     org owner, so only they can push or force-push to `main` directly or merge without approval.
     Everyone else goes through approved PRs. **Don't make anyone else an org owner** unless they
     should have that same power. Lab leads manage the Editors team as team maintainers instead.
5. **People and teams:**

   | Team | Who | Repo access | Can approve | Extra |
   |---|---|---|---|---|
   | `@CyberPsychLab/lab-leads` | PI / lab leadership | Write | content PRs | Team **maintainer** of `editors`, so they can add and remove editors |
   | `@CyberPsychLab/editors` | lab members who edit content | Write | content PRs | — |
   | `@AMoo-Miki` (only org owner) | site maintainer | Admin | everything | Only person who can bypass the ruleset: push/force-push to `main`, merge without approval |

   - Approval rules live in `.github/CODEOWNERS`. `src/content/` and `public/files/` can be approved
     by either team. Everything else (code, config, workflows, docs) needs the maintainer.
   - Someone can't approve their own PR, so an editor's change needs another editor, a lab lead, or
     the maintainer.
   - Write access lets editors push branches (needed by AI tools), but the `Protect main` ruleset
     still forces every change through a reviewed PR with passing checks.
   - **Adding an editor:** the person needs a GitHub account and must be an org member. An owner
     invites them to the org (People → Invite member); a lab lead or owner then adds them to `editors`.
   - Org member privileges: members can't create repositories or teams.
6. **Dependabot** is configured in `.github/dependabot.yml`. It opens weekly PRs for npm updates
   (grouped, after a 7-day cooldown) and monthly PRs for GitHub Actions.

## DNS: Route 53

In the AWS console: **Route 53 → Hosted zones → cyberpsychlab.com**.

First, if the domain was registered somewhere other than Route 53, make sure the registrar's name
servers match the four `NS` values in the hosted zone. (If you registered it through Route 53, this
is already done.)

Create these records:

| Record name | Type | Value | TTL |
|---|---|---|---|
| *(blank, the apex)* | A | `185.199.108.153`<br>`185.199.109.153`<br>`185.199.110.153`<br>`185.199.111.153` | 3600 |
| *(blank, the apex)* | AAAA | `2606:50c0:8000::153`<br>`2606:50c0:8001::153`<br>`2606:50c0:8002::153`<br>`2606:50c0:8003::153` | 3600 |
| `www` | CNAME | `cyberpsychlab.github.io` | 3600 |
| `_github-pages-challenge-CyberPsychLab` | TXT | *the value GitHub shows when verifying the domain* (in quotes) | 3600 |

Notes:
- Route 53 "Alias" records only point to AWS resources, so use the plain A/AAAA records above.
- Don't create a wildcard (`*.cyberpsychlab.com`) record. It makes subdomain takeover possible.
- If you ever add a **CAA** record, include `0 issue "letsencrypt.org"` or GitHub can't issue the HTTPS certificate.
- If the lab later wants email at this domain (MX records), that doesn't affect the website records.

Check from a terminal:

```bash
nslookup cyberpsychlab.com
```

```bash
nslookup www.cyberpsychlab.com
```

```bash
nslookup -type=TXT _github-pages-challenge-CyberPsychLab.cyberpsychlab.com
```

## Updating dependencies

Merge Dependabot PRs once **Build and check content** is green. For Astro major versions, read the
upgrade guide at https://docs.astro.build/en/guides/upgrade-to/ first and test with `npm run dev`.

**Known audit note (Nov 2026):** `npm audit` reports a ReDoS advisory in `picomatch` (all versions
≤ 4.0.7, no fix released yet), used by Astro/Vite at build time. It only matters with
attacker-controlled glob patterns. This site's patterns are fixed in the code, and nothing runs
in visitors' browsers, so the risk is nil. Dependabot will pick up the fix when it ships.
`npm audit fix --force` would *downgrade* Astro to 5.x, so don't run it.

## Code map

```
src/
  content.config.ts      content schemas (rules editors' files must follow)
  content/               all site content (see docs/EDITING.md)
  lib/content.ts         queries: sorting, drafts, reference checks
scripts/lint-content.mjs naming/organization lint (rules in docs/CONTENT-RULES.md; keep in sync)
  layouts/Base.astro     page shell: head/meta, header, nav, footer
  components/            ProjectCard, PubItem, Avatar, NetworkBanner
  pages/                 one file per page (/, /about, /projects, /publications, /posters, /people, /join, 404)
  styles/global.css      all styles; colors are CSS variables with a dark-mode set
public/                  copied as-is (favicon, PDFs under /files/)
docs/templates/          copy-paste templates for editors
```
