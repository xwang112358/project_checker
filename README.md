# Project Checker

A lightweight tool for CS PhD students to track research progress across multiple GitHub repos. It auto-syncs every 6 hours, traverses all branches, and uses AI to generate readable weekly and monthly summaries.

---

## What it does

- Connects to your GitHub repos (public **and** private, including repos you collaborate on)
- Pulls commits from **all branches**, PRs, and issues automatically every 6 hours
- Generates AI-powered structured weekly and monthly summaries per project
- Shows which projects are active, slowing down, or stalled
- Lets you drag-and-drop to reorder projects on the dashboard
- Lets you add manual notes for work not visible in GitHub
- Supports **Azure OpenAI, OpenAI, Anthropic Claude, and OpenRouter**

---

## Prerequisites

- [Node.js 18+](https://nodejs.org/) installed
- A [GitHub account](https://github.com) with repos you want to track
- An API key from one of the supported AI providers (see below)

---

## Quick start

### 1. Install dependencies

```bash
cd project_checker
npm install
```

### 2. Set up the database

```bash
npm run db:push
```

This creates a local SQLite database (`prisma/dev.db`).

### 3. Configure your credentials

```bash
cp .env.local.example .env.local
```

Then open `.env.local` and fill in your values (see sections below).

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The setup wizard will guide you through connecting GitHub and your AI provider.

---

## Getting your GitHub token

Use a **classic Personal Access Token** (PAT) with the `repo` scope. This is the recommended option because it supports private repos where you are a collaborator (not just the owner).

1. Go to [GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens/new)
2. Click **Generate new token (classic)**
3. Set expiration and check the **`repo`** scope
4. Copy the token and add it to `.env.local`:
   ```
   GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

> **Fine-grained PAT alternative**: Works for repos you own. For repos owned by others where you are a collaborator, fine-grained PATs may not have access — use a classic PAT in that case.

---

## Choosing an AI provider

Set `AI_PROVIDER` in `.env.local` to one of: `azure`, `openai`, `anthropic`, `openrouter`. Then fill in the credentials for that provider only.

### Option A — Azure OpenAI

```
AI_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

---

### Option B — OpenAI

```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini   # optional, default: gpt-4o-mini
```

---

### Option C — Anthropic Claude

```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-haiku-20241022   # optional, default: claude-3-5-haiku-20241022
```

---

### Option D — OpenRouter

OpenRouter lets you access many models (Claude, GPT-4o, Gemini, Llama, etc.) through a single API key.

```
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3.5-haiku   # optional, default: anthropic/claude-3.5-haiku
```

---

## Your `.env.local` file

After filling in, your file should look like one of these examples:

**Azure OpenAI:**
```
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AI_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

**OpenAI:**
```
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

**Anthropic:**
```
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

**OpenRouter:**
```
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3.5-haiku
```

> This file is listed in `.gitignore` and will never be committed to git.

---

## Using the app

### Setup wizard

The first time you open the app, a setup wizard walks you through:
1. Connecting your GitHub token (validates it and shows your username)
2. Connecting your AI provider (sends a test prompt to verify it works)
3. Adding your first repos (enter `owner/repo` format, e.g. `yourname/rna-docking`)

You can return to the setup wizard anytime by clicking the ⚙️ icon in the top right.

### Dashboard

The main dashboard shows:
- **Overview stats**: total projects, active / slow / stalled counts
- **This week / This month highlights**: most active project, inactive count
- **Project cards**: one per tracked repo, showing status, last activity, and AI-generated summaries
- **Drag-to-reorder**: hover any card to reveal a grab handle — drag to rearrange. Order is persisted across reloads.

### Auto-sync

The app automatically syncs all repos every **6 hours** while the browser tab is open. If the tab was closed for more than 6 hours, it syncs immediately on the next page load.

To sync right now: click **"Sync now"** in the top bar.

Each sync traverses **all branches** (up to 30) and deduplicates commits by SHA, so work on feature branches is always captured. The sync always looks back at least 35 days to ensure newly-tracked branches are not missed.

### Project detail page

Click any project card to open the detail view:
- Full weekly and monthly summaries with AI source badge
- Activity timeline (commits, PRs, issues, notes)
- Per-repo sync button
- Manual notes for the current week (outside-GitHub progress, next steps)

### AI summaries

Each project shows two summaries:
- **Last week**: what changed in the last 7 days
- **Last month**: the 30-day trend

Summaries use a structured format with dated bullets sorted newest → oldest:

```
What changed
• Mar 12  Implemented multi-objective scoring module
• Mar 9   Refactored protein binding interface
• Mar 5   Fixed gradient computation bug
```

Summaries show a **✨ AI summary** badge when generated by your configured provider, or a **⚠ Rule-based** badge if the AI call failed. Click **Regenerate** to request a fresh version.

---

## Adding a repo you collaborate on

You can track any repo you have read access to, including private repos owned by someone else. Enter it as `owner/repo` in the setup wizard (e.g. `collaborator-name/their-repo`).

Requirements:
- Your GitHub PAT must be a **classic PAT with `repo` scope** (fine-grained PATs may not see collaborator repos owned by other individuals)
- For org repos: the org admin may need to approve your PAT — you will see "Repo not accessible" if this is missing

---

## Sync behavior

| Trigger | What happens |
|---|---|
| Page load (tab was closed >6h) | Immediate full sync |
| "Sync now" button (dashboard) | Sync all repos |
| "Sync now" button (project page) | Sync that repo only |
| Auto (every 6h while tab is open) | Full sync |

After each sync, summaries are regenerated for the current week and month.

---

## Troubleshooting

### "Repo not accessible" on a card
Your GitHub token does not have access to that repo. Check:
- You are using a **classic PAT** with the `repo` scope (not fine-grained)
- The token has not expired (GitHub → Settings → Developer settings → your token)
- For org repos: you may need to authorize the token for that organization

### "Token expired" banner
Your `GITHUB_PAT` has expired. Generate a new token and update `.env.local`, then restart the dev server.

### AI test fails in setup wizard
- Check that `AI_PROVIDER` in `.env.local` matches the credentials you filled in
- For Azure: verify the endpoint has no trailing slash and the deployment has finished deploying
- For Anthropic: make sure you ran `npm install @anthropic-ai/sdk`
- Restart the dev server after any `.env.local` change

### Summary shows "Rule-based" instead of AI
- AI credentials may not be configured — check `.env.local` and restart the server
- Use the test connection in the setup wizard to confirm your provider is reachable

### Commits from a branch not showing up
- Trigger a **Sync now** — the sync looks back 35 days across all branches
- The sync covers up to 30 branches per repo; branches beyond that limit may be missed

### Database issues
```bash
npm run db:push
```

---

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server at localhost:3000 |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Apply schema changes to the database |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |

---

## Project structure

```
project_checker/
├── app/                    ← Next.js pages
│   ├── page.tsx            ← Dashboard (with drag-to-reorder)
│   ├── setup/page.tsx      ← Setup wizard
│   └── projects/[id]/      ← Project detail page
├── app/api/                ← Backend API routes
│   ├── sync/               ← GitHub sync endpoints
│   ├── projects/           ← Project CRUD + reorder (PATCH)
│   ├── summaries/          ← Summary generation
│   ├── notes/              ← Manual notes
│   └── setup/validate/     ← Credential validation
├── components/             ← UI components
├── hooks/                  ← useAutoSync hook
├── lib/                    ← Core logic
│   ├── github.ts           ← GitHub API client (all-branch sync)
│   ├── azure-openai.ts     ← Multi-provider AI client
│   ├── summarize.ts        ← Structured summary generation
│   └── db.ts               ← Prisma client
├── prisma/
│   └── schema.prisma       ← Database schema
├── .env.local              ← Your secrets (not committed)
└── .env.local.example      ← Template with all options
```

---

For the full technical specification, see `building_plan.md`.
