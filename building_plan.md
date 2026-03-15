# project_checker

# GitHub-Based PhD Project Progress Tracker

## 1. Goal

Build a lightweight tool that helps a CS PhD student track progress across multiple research projects by using GitHub repo activity as the main signal.

The tool should help answer:

* What did I make progress on last week?
* What changed over the last month?
* Which projects are active, slowing down, or stalled?
* What milestones have been reached recently?

## 2. Core product idea

The tool connects to several GitHub repos (both public and private), pulls commit / PR / issue activity, and turns that into readable project summaries.

The UI should emphasize:

* **last week summary**
* **last month summary**
* current project status
* recent milestones
* stalled project warnings

## 3. Target user

A CS PhD student with several parallel projects, where each project usually has a GitHub repo — most of which will be private.

Typical projects may include:

* method development
* experiment pipelines
* paper codebases
* datasets / preprocessing tools
* collaboration repos

## 4. Main use cases

### Weekly review

The user opens the app and quickly sees:

* which repos were active last week
* what changed
* which project had the most momentum
* which project had no activity

### Monthly review

The user gets a broader view of:

* progress trends over the last month
* larger milestones
* projects that were neglected
* shifts in focus across repos

### Per-project check-in

The user can click into a repo and see:

* recent commits
* PR / issue activity
* main code areas touched
* milestone history
* short generated summaries

## 5. LLM integration via Azure OpenAI

Natural-language summaries are a core feature, not a Phase 2 add-on. The tool uses the **Azure OpenAI API** to convert raw GitHub activity (commit messages, PR titles, issue titles) into readable 2–3 sentence summaries per project per period.

### Why Azure OpenAI

* Enterprise-grade, data stays in the user's Azure tenant
* Same model quality as OpenAI (GPT-4o available)
* No data is sent to third-party training pipelines by default under Azure's terms

### Azure OpenAI setup for new users

The setup wizard includes a dedicated Azure step. For users unfamiliar with Azure, the guide walks them through it:

**How to get your Azure OpenAI credentials:**

1. Go to [portal.azure.com](https://portal.azure.com) and sign in
2. Create an **Azure OpenAI** resource (or use an existing one):
   * Search "Azure OpenAI" in the top bar → Create
   * Choose a region that supports GPT-4o (e.g. East US, Sweden Central)
   * Tier: Standard S0 is sufficient
3. Once created, go to the resource → **Keys and Endpoint**
   * Copy **Key 1** → this is your `AZURE_OPENAI_API_KEY`
   * Copy **Endpoint** → this is your `AZURE_OPENAI_ENDPOINT` (e.g. `https://my-resource.openai.azure.com`)
4. Go to **Azure OpenAI Studio** → **Deployments** → **Deploy model**
   * Select `gpt-4o` (recommended) or `gpt-4o-mini` for lower cost
   * Give it a deployment name (e.g. `gpt-4o`) → copy this name as `AZURE_OPENAI_DEPLOYMENT`
5. Paste all three values into the app's setup screen

The app's setup wizard includes a "Test connection" button that sends a minimal prompt to verify the credentials before saving.

### Required environment variables

```
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<your-key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

All stored in `.env.local`, never in the database, never committed.

### How summaries are generated

When a sync completes for a period (weekly or monthly), the backend:

1. Collects all commit messages, PR titles, and issue titles for the period
2. Truncates to fit within the model's context (most repos will be well under the limit)
3. Sends a structured prompt to Azure OpenAI:

```
You are summarizing a research project's GitHub activity.

Period: last 7 days
Commits (6): "fix scoring bug", "clean input pipeline", "add eval script", ...
PRs merged (1): "preprocessing refactor"
Issues closed (0): —

Write a 2–3 sentence summary of what changed and what it likely means for the project's progress.
Be specific about which parts of the project were worked on. Avoid vague filler phrases.
```

4. Stores the response in `Summary.generated_summary`
5. Summaries are cached — not re-generated on every page load, only regenerated when new activity arrives or the user clicks "Regenerate"

### Graceful fallback

If the Azure OpenAI call fails (quota exceeded, misconfigured, network error), the app falls back to a rule-based summary automatically:

* Rule-based summary: "{N} commits last week. Main areas: {folders}. {N} PRs merged."
* A small indicator shows whether the summary is LLM-generated or rule-based
* The user can trigger a retry from the card or detail page

### Cost considerations

* GPT-4o-mini is recommended for cost efficiency (~$0.15/1M input tokens)
* Most weekly summaries will use under 500 tokens total
* For 10 projects × weekly + monthly summaries = ~20 API calls per sync cycle
* Estimated cost: well under $0.01 per full sync at gpt-4o-mini rates

---

## 6. Authentication and private repo access

This is a single-user personal tool. GitHub OAuth is not needed. A **GitHub Personal Access Token (PAT)** is the right approach.

### New user onboarding flow

The first time the user opens the app, they are shown a guided setup wizard — not a blank config screen. It should feel friendly and take under 5 minutes to complete.

**Step 1 — Welcome screen**

Brief explanation of what the tool does and what it needs:
> "project_checker reads your GitHub repos to summarize your research progress. It needs two things: a GitHub token to access your repos, and an Azure OpenAI key to generate readable summaries. Both take about 5 minutes to set up."

A "Get started" button leads to Step 2.

**Step 2 — Create a GitHub token**

An in-app guide with a numbered checklist and screenshots:

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
   *(A direct link button opens this page in a new tab.)*
2. Click **"Generate new token"**
3. Set a token name (suggested: `project-checker`)
4. Set expiration (suggested: 1 year)
5. Under **Repository access**, choose **"All repositories"** or select specific repos
6. Under **Permissions**, enable:
   * `Contents` → Read-only
   * `Pull requests` → Read-only
   * `Issues` → Read-only
   * `Metadata` → Read-only (auto-selected)
7. Click **"Generate token"** and copy the token

A "I've created my token" button leads to Step 3.

**Step 3 — Paste and validate GitHub token**

* A single text input: "Paste your token here"
* A "Connect" button that calls GitHub's `/user` endpoint to validate the token
* On success: show the GitHub username and avatar as confirmation
* On failure: show a plain-English error and a link back to Step 2

**Step 4 — Configure Azure OpenAI**

An in-app guide walks the user through getting their Azure credentials (see section 5 for the full guide). Three inputs:

* Endpoint URL (e.g. `https://my-resource.openai.azure.com`)
* API Key
* Deployment name (e.g. `gpt-4o`)

A "Test connection" button sends a minimal prompt to verify credentials before saving. On success: show model name and confirmation. On failure: plain-English error (bad key, wrong endpoint, deployment not found).

**Step 5 — Add your first repos**

* A search-as-you-type input: "Enter a repo (e.g. `myusername/my-project`)"
* The app verifies the repo is accessible with the token before adding it
* Shows a brief success state: repo name, visibility badge, and last commit date
* "Add another repo" or "Go to dashboard" buttons

The user can always return to Settings to add/remove repos, update their GitHub token, or update their Azure credentials.

### Token storage

* The token is stored in a `.env.local` file on the user's machine, never in the database.
* The `.env.local` file is listed in `.gitignore` so it is never committed.
* The app checks on startup whether `GITHUB_PAT` is set, and redirects to setup if not.

### Token type and required scopes

Use a **fine-grained PAT** (GitHub's newer format, preferred over classic PATs):

* `Contents: Read-only` — for commits and file tree
* `Pull requests: Read-only` — for PR activity
* `Issues: Read-only` — for issue activity
* `Metadata: Read-only` — for repo info (implicitly required)

A classic PAT with the `repo` scope also works as a fallback (the setup guide mentions this for users who prefer it).

### Token security

* The PAT is only used server-side (Next.js API routes). It is never sent to the browser.
* All GitHub API calls are proxied through the backend. The frontend never calls GitHub directly.

### Token expiry and re-authentication

* When a token expires, affected repo cards show a gentle warning: "Token expired — update in Settings"
* A banner at the top of the dashboard shows when all syncs are failing due to auth issues
* Settings page allows the user to paste a new token without losing any data

### Error handling for access issues

The UI must distinguish and surface:

* **401** — token is invalid or expired → show "Token expired — go to Settings" banner
* **403** — token lacks required scope → show "Missing permission: [scope name]" with a link to regenerate
* **404** — repo not found or token has no access → show "Repo not accessible" on the card with a help tooltip
* **No activity** — repo exists but has zero commits → show "Empty repo" state rather than a blank card

## 6. Product requirements

### Must-have

#### Repo integration

* connect multiple GitHub repos (public and private)
* fetch commits, PRs, issues via authenticated API calls
* incremental sync: only fetch activity since the last sync timestamp
* **auto-sync every 3 hours** while the app is open in the browser
* **force sync button** on the dashboard to trigger an immediate sync at any time
* per-repo sync status and last-synced timestamp visible in the UI

#### Rate limiting

* GitHub API allows 5,000 requests/hour with a PAT
* Use `since=` date parameters on all list endpoints to minimize request count
* Show current rate limit status (remaining / reset time) in the UI
* If rate limit is hit, show a clear message and the reset time rather than silently failing

#### Project status

Each project should be labeled as:

* **active**: meaningful activity in the last 7 days
* **slow**: some activity in the last 8–14 days
* **stalled**: no meaningful activity in the last 14+ days

#### Weekly summary

For each project, generate:

* commit count last week
* PRs opened/merged last week
* issues opened/closed last week
* last activity date
* short natural-language summary of what changed

#### Monthly summary

For each project, generate:

* total activity over the last 30 days
* trend compared to the prior weeks
* major themes of work (based on touched folders)
* milestone highlights
* inactivity warnings

#### Project detail page

For each project:

* timeline of recent activity
* common files/folders changed
* recent commits and PRs
* weekly summary block
* monthly summary block

#### Manual notes

Allow the user to enter a brief note per project:

* "outside GitHub progress"
* "next step"

This covers work not visible in the repo.

### Nice-to-have

* milestone tagging
* commit type classification
* advisor-meeting summary export
* trend charts
* GitHub org/repo grouping
* email or desktop reminder for stalled projects

## 7. UI requirements

### Setup wizard (first launch only)

The setup wizard is a multi-step flow designed to be completable in under 10 minutes with no prior knowledge required.

* **Step 1 — Welcome**: explains what the tool needs (GitHub token + Azure OpenAI key) and why
* **Step 2 — GitHub token guide**: numbered checklist with direct link to GitHub token page, scope selection guidance
* **Step 3 — GitHub token input**: paste field, "Connect" button, live validation showing username + avatar on success
* **Step 4 — Azure OpenAI config**: endpoint + API key + deployment name inputs, "Test connection" button with success/failure feedback
* **Step 5 — Add repos**: search-by-name input, per-repo validation showing visibility and last commit, option to add more or go to dashboard

The setup wizard is accessible from Settings at any time (e.g. to update either token or add repos). Individual steps can be re-done independently — the user doesn't have to redo everything to update just the Azure key.

### Main dashboard

This is the first screen after setup.

Each project appears as a card with:

* project name
* repo name + link
* visibility badge (private / public)
* status badge (active / slow / stalled)
* last activity date
* last week summary
* last month summary
* recent milestone
* warning if stalled
* error state if repo is inaccessible

#### Card example

**Project: RNA Docking** `private`
Status: Active
Last activity: 2 days ago

**Last week**

* 6 commits
* 1 PR merged
* main changes: preprocessing, evaluation script
* summary: cleaned input pipeline and fixed scoring bug

**Last month**

* 22 commits
* 3 PRs merged
* trend: steady
* summary: project moved from debugging to experiment-ready

### Dashboard sections

#### Section A: Overview

* total number of tracked projects
* active / slow / stalled counts
* most active project this week
* most active project this month
* rate limit indicator
* last synced time (e.g. "Last updated 42 min ago")
* **"Sync now" button** — triggers an immediate full sync of all repos; shows a spinner while in progress
* next auto-sync countdown (e.g. "Next auto-sync in 2h 18m")

#### Section B: Last week

A compact summary panel:

* top 3 active projects
* projects with no activity
* key milestone this week
* quick narrative summary

#### Section C: Last month

A broader summary panel:

* top projects by activity
* newly stalled projects
* projects with sustained momentum
* monthly narrative summary

### Project detail page

Each project page should include:

#### Header

* project name
* repo link
* visibility (private / public)
* status
* last activity
* last sync time (e.g. "Synced 42 min ago")
* **"Sync now" button** — syncs this repo only; shows a spinner while in progress
* milestone tag

#### Last week summary block

* commits
* PRs
* issues
* touched areas
* generated text summary

#### Last month summary block

* longer trend summary
* activity chart
* milestone list
* warnings / observations

#### Activity timeline

Chronological list of:

* commits
* merged PRs
* closed issues
* milestone events
* manual notes

#### Manual notes panel

* outside-GitHub progress
* next step

## 8. Summary generation logic

The tool converts raw GitHub activity into readable summaries using Azure OpenAI, with a rule-based fallback.

### Input to the LLM

For each summary period, collect:

* all commit messages (author, date, message)
* all PR titles and statuses (opened / merged / closed)
* all issue titles and statuses (opened / closed)
* top touched folders/files (derived from commit file lists)
* activity counts and trend direction

This raw data is formatted into a structured prompt and sent to the configured Azure OpenAI deployment.

### Last week summary

Prompt goal: what changed in the last 7 days, where was effort concentrated, was there meaningful progress?

Example output:
"Last week, this repo was moderately active. Most changes were in the training and evaluation pipeline. A PR merging preprocessing fixes suggests the project is moving past setup issues and toward stable experiments."

### Last month summary

Prompt goal: what happened over the last 30 days, is the project gaining momentum or fading, were there visible milestones?

Example output:
"Over the last month, activity was steady and concentrated on infrastructure and debugging. The repo shows a transition from setup work to experiment execution, suggesting the project is entering a more productive phase."

### Rule-based fallback

Used automatically when Azure OpenAI is unavailable or unconfigured:

* commit counts and frequency
* touched files/folders (grouped by top-level directory)
* PR merges and issue closures
* week-over-week activity trend (increasing / steady / declining)

A small badge on each summary card indicates whether it was LLM-generated or rule-based. The user can click "Regenerate with AI" to retry an LLM summary after fixing credentials.

## 9. Data model

### Project

* id
* name
* repo_owner
* repo_name
* description
* visibility (`public` or `private`)
* status (`active`, `slow`, `stalled`, `error`)
* status_error_message
* last_activity_at
* last_synced_at
* latest_milestone
* created_at
* updated_at

### Commit

* id
* project_id
* sha
* author
* message
* date
* files_changed_count
* additions
* deletions

### PullRequest

* id
* project_id
* github_pr_id
* title
* status
* opened_at
* merged_at
* closed_at

### Issue

* id
* project_id
* github_issue_id
* title
* status
* opened_at
* closed_at

### Summary

* id
* project_id
* period_type (`weekly` or `monthly`)
* period_start
* period_end
* commit_count
* pr_opened_count
* pr_merged_count
* issue_opened_count
* issue_closed_count
* top_touched_folders
* generated_summary
* trend_label (`increasing`, `steady`, `declining`, `none`)

### ManualNote

* id
* project_id
* week_start
* outside_progress_note
* next_step_note

### Milestone

* id
* project_id
* label
* description
* source_type
* source_ref
* created_at

### Settings

* key (e.g., `github_pat_configured`, `azure_openai_configured`, `sync_interval_minutes`, `last_global_sync_at`)
* value
* updated_at

The actual PAT and Azure API key are stored only in `.env.local`, never in the database. The Settings table stores flags and non-sensitive preferences only, including the sync interval (default: `180` minutes) and the timestamp of the last completed global sync.

## 10. Architecture

**Next.js (App Router) full-stack** — one process, no separate backend service needed. All secrets (GitHub PAT, Azure API key) stay server-side.

```
project_checker/
├── app/
│   ├── page.tsx                  ← dashboard
│   ├── setup/page.tsx            ← setup wizard (GitHub + Azure + repos)
│   └── projects/[id]/page.tsx    ← project detail page
├── app/api/
│   ├── sync/route.ts             ← triggers GitHub fetch + summary generation
│   ├── projects/route.ts         ← CRUD for tracked repos
│   ├── summaries/route.ts        ← aggregation + LLM summary trigger
│   └── setup/validate/route.ts   ← validates GitHub PAT and Azure credentials
├── lib/
│   ├── github.ts                 ← GitHub API client (reads GITHUB_PAT from env)
│   ├── azure-openai.ts           ← Azure OpenAI client (reads keys from env)
│   ├── summarize.ts              ← builds prompts, calls Azure, falls back to rule-based
│   └── db.ts                     ← Prisma client + SQLite
├── prisma/
│   └── schema.prisma             ← DB schema
├── .env.local                    ← all secrets (not committed)
└── .gitignore                    ← must include .env.local
```

### `.env.local` variables

```
# GitHub
GITHUB_PAT=ghp_xxxx

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

### Tech stack

* **Framework**: Next.js (App Router)
* **Database**: SQLite via Prisma (local-first, no server needed)
* **GitHub API**: Octokit or raw fetch with PAT from `process.env.GITHUB_PAT`
* **LLM**: Azure OpenAI via `@azure/openai` SDK
* **Charts**: Recharts or Chart.js for trend graphs
* **Styling**: Tailwind CSS

### Key architectural rules

* GitHub API calls and Azure OpenAI calls happen only in `app/api/` routes — never in client components
* All secrets are read from `process.env.*` server-side only
* Incremental sync: all GitHub list endpoints use `since=<last_synced_at>` to avoid re-fetching known data
* Pagination: handle GitHub's 100-item page limit with cursor-based pagination on all list endpoints
* LLM summaries are generated once per period and cached in the DB — not re-called on every page load

### Auto-sync and force sync

The 3-hour auto-sync is implemented as a **client-side interval** running in the browser tab:

* On page load, the dashboard checks `last_global_sync_at` from the DB
* If more than 3 hours have passed since the last sync, a sync is triggered immediately on load
* Otherwise, a `setInterval` is set to fire at the remaining time until the 3-hour mark
* After each sync completes, the interval resets to 3 hours from now
* The countdown ("Next auto-sync in Xh Xm") is a live UI ticker updated every minute

**Implications of client-side scheduling:**

* Auto-sync only runs while the browser tab is open — this is acceptable for a personal tool
* If the app is closed for several days and reopened, a sync fires immediately on load
* The interval resets cleanly on page reload — no risk of double-syncing

**Force sync button:**

* Available globally in the dashboard header ("Sync now") — syncs all repos
* Also available per-repo in the project detail page header ("Sync now") — syncs that repo only
* Both buttons are disabled and show a spinner during an in-progress sync
* After a force sync completes, the auto-sync interval resets to 3 hours from now
* The sync interval (default 3 hours) is configurable in Settings (minimum: 30 minutes)

## 11. Milestones

### Milestone 0: Setup and onboarding

Success criteria:

* first-time user is shown the setup wizard, not a blank screen
* GitHub token creation guide is clear enough for a user unfamiliar with PATs
* GitHub token is validated before saving; username + avatar shown on success
* Azure OpenAI credentials (endpoint, key, deployment) can be entered and tested
* Azure test call succeeds and shows model name on success; shows plain-English error on failure
* All secrets stored in `.env.local` only, never in the DB
* User can add repos by name with live validation of accessibility
* App redirects to setup wizard if `GITHUB_PAT` or Azure credentials are not configured
* User can update any credential or add/remove repos from Settings independently
* DB schema is initialized

### Milestone 1: GitHub ingestion pipeline and sync scheduling

Success criteria:

* commits, PRs, and issues are fetched for all tracked repos
* incremental sync works (only fetches new activity since last sync)
* pagination is handled correctly for repos with many items
* rate limit errors are caught and surfaced clearly
* per-repo `last_synced_at` is updated after each successful sync
* private repos are fetched correctly using the PAT
* auto-sync fires every 3 hours while the tab is open
* sync on page load if last sync was more than 3 hours ago
* "Sync now" button on the dashboard triggers an immediate sync of all repos
* "Sync now" button on the project detail page triggers a single-repo sync
* both sync buttons show a spinner during sync and are disabled to prevent double-triggering
* next auto-sync countdown is visible and updates live
* sync interval is configurable in Settings (default: 3 hours, minimum: 30 minutes)

### Milestone 2: Dashboard is usable

Success criteria:

* project cards render correctly with all fields
* active / slow / stalled status logic works
* private / public visibility badge shows correctly
* error states show for inaccessible repos
* last activity and last sync time are visible

### Milestone 3: Weekly and monthly summaries work

Success criteria:

* each project shows a readable summary for last week and last month
* LLM-generated summaries (via Azure OpenAI) are produced after each sync
* if Azure OpenAI is unavailable, rule-based fallback summary is shown with a badge
* counts and date ranges are correct
* top touched folders are surfaced
* trend label (increasing / steady / declining) is accurate
* summaries are cached in the DB and not regenerated on every page load
* user can click "Regenerate" to request a fresh LLM summary

### Milestone 4: Project detail page is useful

Success criteria:

* user can inspect one project in depth
* activity timeline is chronological and complete
* manual notes can be added and saved
* weekly and monthly summary blocks are shown

## 12. Phases

### Phase 1: MVP foundation (Milestones 0–4)

* GitHub PAT + Azure OpenAI setup wizard
* DB schema and Prisma setup
* GitHub fetch pipeline with incremental sync and pagination
* Azure OpenAI summary generation with rule-based fallback
* Dashboard cards with status badges
* Weekly/monthly aggregation

### Phase 2: Better summaries and theme detection

* Classify activity themes from folder names and commit messages
* Improve prompt to include folder context for richer LLM summaries
* Detect frequently touched folders
* Improve status detection edge cases
* Add milestone tagging

### Phase 3: Polished research workflow

* Advisor-review export (uses LLM to generate a narrative across all projects)
* Trend charts
* Notification for stalled projects

## 13. Risks

### Private repo access can break silently

If the PAT expires, is revoked, or lacks the right scopes, syncs will fail without a clear signal.

Mitigation:

* catch 401/403 errors per-repo and display them as error states on cards
* show the last successful sync time so the user notices staleness

### Rate limiting under heavy use

Fetching activity for many repos at once can exhaust the 5,000 req/hour limit.

Mitigation:

* incremental sync with `since=` parameters reduces requests significantly
* show rate limit status and remaining count in the UI

### Azure OpenAI unavailability or misconfiguration

If the Azure endpoint is wrong, the key expires, or the deployment is deleted, summaries silently fail or show errors.

Mitigation:

* validate credentials at setup and surface errors with plain-English messages
* automatic fallback to rule-based summaries so the dashboard always shows something useful
* a badge distinguishes LLM vs rule-based summaries so the user knows what they're looking at
* "Regenerate" button allows retrying after credentials are fixed

### Azure OpenAI costs

Unexpected usage or misconfigured retry logic could drive up API costs.

Mitigation:

* cache all summaries in the DB — never call the API for a period already summarized
* use GPT-4o-mini by default (cheapest capable model)
* show estimated token usage per sync in the Settings page

### Repo activity is an incomplete proxy

Some real work will not appear in GitHub.

Mitigation:

* include manual notes for outside-GitHub progress

### Raw commit counts can be misleading

Many small commits do not always mean strong progress.

Mitigation:

* combine commit counts with PR merges, issue closure, and touched folders

### Research commits are often messy

Messages may not be standardized.

Mitigation:

* start with simple extraction and keep summaries conservative

## 14. Success criteria

The tool is successful if, after opening it for 2 minutes, the user can clearly say:

* what they did last week
* what changed over the last month
* which projects are progressing
* which projects need attention next

## 15. Recommended first version

Build exactly this:

* one-time setup screen for PAT entry and repo management
* dashboard with one card per project showing:
  * visibility (private / public)
  * status badge
  * last activity
  * last week summary
  * last month summary
* click into project for detail timeline
* optional manual weekly note
* incremental sync with a "refresh" button

That is small enough to build in a focused sprint, but already genuinely useful for tracking PhD research progress across private and public repos.
