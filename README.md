# project_checker

A lightweight tool for CS PhD students to track research progress across multiple GitHub repos. It auto-syncs every 3 hours and uses Azure OpenAI to generate readable weekly and monthly summaries.

---

## What it does

- Connects to your GitHub repos (public **and private**)
- Pulls commits, PRs, and issues automatically every 3 hours
- Generates AI-powered weekly and monthly summaries per project
- Shows which projects are active, slowing down, or stalled
- Lets you add manual notes for work not visible in GitHub

---

## Prerequisites

Before you start, make sure you have:

- [Node.js 18+](https://nodejs.org/) installed
- A [GitHub account](https://github.com) with repos you want to track
- An [Azure account](https://portal.azure.com) with access to Azure OpenAI

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

Copy the example env file:

```bash
cp .env.local.example .env.local
```

Then open `.env.local` and fill in your values (see the sections below for how to get each one).

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The setup wizard will guide you through connecting GitHub and Azure OpenAI.

---

## Getting your GitHub token

You need a **fine-grained Personal Access Token** (PAT) with read-only access to your repos.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
   [Direct link →](https://github.com/settings/personal-access-tokens/new)

2. Click **"Generate new token"**

3. Fill in:
   - **Token name**: `project-checker`
   - **Expiration**: 1 year (or longer)
   - **Repository access**: All repositories *(or select specific ones)*

4. Under **Permissions**, enable these (all Read-only):
   | Permission | Level |
   |---|---|
   | Contents | Read-only |
   | Pull requests | Read-only |
   | Issues | Read-only |
   | Metadata | Read-only (auto-selected) |

5. Click **"Generate token"** and copy it immediately (you won't see it again)

6. Paste it into `.env.local`:
   ```
   GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

> **Classic PAT alternative**: If you prefer, you can use a classic PAT (`repo` scope). Go to [Personal access tokens (classic)](https://github.com/settings/tokens/new) and check the `repo` scope.

---

## Getting your Azure OpenAI credentials

### Step 1 — Create an Azure OpenAI resource

1. Sign in at [portal.azure.com](https://portal.azure.com)
2. Search for **"Azure OpenAI"** in the top bar → click **Create**
3. Fill in:
   - **Subscription**: your Azure subscription
   - **Resource group**: create new or use existing
   - **Region**: choose one that supports GPT-4o (e.g. East US, Sweden Central)
   - **Name**: anything you like (e.g. `my-openai`)
   - **Pricing tier**: Standard S0
4. Click **Review + create** → **Create** and wait for deployment (~2 min)

### Step 2 — Get your endpoint and API key

1. Go to your new Azure OpenAI resource
2. Click **Keys and Endpoint** in the left sidebar
3. Copy:
   - **Key 1** → this is your `AZURE_OPENAI_API_KEY`
   - **Endpoint** → this is your `AZURE_OPENAI_ENDPOINT` (looks like `https://my-openai.openai.azure.com`)

### Step 3 — Deploy a model

1. Click **Go to Azure OpenAI Studio** (or go to [oai.azure.com](https://oai.azure.com))
2. Click **Deployments** → **Deploy model** → **Deploy base model**
3. Select **gpt-4o-mini** (recommended — low cost, good quality)
4. Give it a deployment name, e.g. `gpt-4o-mini`
5. Click **Deploy**
6. Copy the deployment name → this is your `AZURE_OPENAI_DEPLOYMENT`

### Step 4 — Update `.env.local`

```
AZURE_OPENAI_ENDPOINT=https://my-openai.openai.azure.com
AZURE_OPENAI_API_KEY=abc123...
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

> **Cost estimate**: GPT-4o-mini is ~$0.15 per million input tokens. A typical sync with 10 projects costs well under $0.01.

---

## Your `.env.local` file

After filling everything in, your file should look like this:

```
# GitHub
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

> This file is listed in `.gitignore` and will never be committed to git.

---

## Using the app

### Setup wizard

The first time you open the app, a setup wizard walks you through:
1. Connecting your GitHub token (validates it and shows your username)
2. Connecting Azure OpenAI (sends a test prompt to verify it works)
3. Adding your first repos (enter `owner/repo` format, e.g. `yourname/rna-docking`)

You can return to the setup wizard anytime by clicking the ⚙️ icon in the top right.

### Dashboard

The main dashboard shows:
- **Overview stats**: total projects, active / slow / stalled counts
- **This week / This month highlights**: most active project, inactive count
- **Project cards**: one per tracked repo, showing status, last activity, and AI-generated summaries

### Auto-sync

The app automatically syncs all repos every **3 hours** while the browser tab is open. If the tab was closed for more than 3 hours, it syncs immediately on the next page load.

To sync right now: click the **"Sync now"** button in the top bar.

### Project detail page

Click any project card to open the detail view:
- Full weekly and monthly summaries with AI source badge
- Activity timeline (commits, PRs, issues, notes)
- Per-repo sync button
- Manual notes for the current week (outside-GitHub progress, next step)

### AI summaries

Each project shows two summaries:
- **Last week**: what changed in the last 7 days
- **Last month**: the 30-day trend

Summaries show a **✨ AI summary** badge when generated by Azure OpenAI, or a **⚠ Rule-based** badge if the AI call failed. Click **Regenerate** on any summary to request a fresh AI version.

---

## Sync behavior

| Trigger | What happens |
|---|---|
| Page load (tab was closed >3h) | Immediate full sync |
| "Sync now" button (dashboard) | Sync all repos |
| "Sync now" button (project page) | Sync that repo only |
| Auto (every 3h while tab is open) | Full sync |

After each sync, summaries are regenerated for the current week and month.

---

## Troubleshooting

### "Repo not accessible" on a card
Your GitHub token doesn't have access to that repo. Check:
- The token has the correct scopes (`Contents`, `Pull requests`, `Issues`, `Metadata`)
- The token hasn't expired (GitHub → Settings → Developer settings → your token)
- For org repos: you may need to authorize the token for that organization

### "Token expired" banner
Your `GITHUB_PAT` has expired. Generate a new token following the steps above and update `.env.local`, then restart the dev server.

### Azure OpenAI test fails
- Double-check the endpoint URL (no trailing slash, includes `.openai.azure.com`)
- Verify the deployment name matches exactly what you set in Azure OpenAI Studio
- Make sure the model has finished deploying (check status in Studio → Deployments)

### Summary shows "Rule-based" instead of AI
- Azure credentials may not be configured — check `.env.local` and restart the server
- The test connection in the setup wizard can confirm whether Azure is reachable

### Database issues
If you see Prisma errors, re-run:
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
│   ├── page.tsx            ← Dashboard
│   ├── setup/page.tsx      ← Setup wizard
│   └── projects/[id]/      ← Project detail page
├── app/api/                ← Backend API routes
│   ├── sync/               ← GitHub sync endpoints
│   ├── projects/           ← Project CRUD
│   ├── summaries/          ← Summary generation
│   ├── notes/              ← Manual notes
│   └── setup/validate/     ← Credential validation
├── components/             ← UI components
├── hooks/                  ← useAutoSync hook
├── lib/                    ← Core logic
│   ├── github.ts           ← GitHub API client
│   ├── azure-openai.ts     ← Azure OpenAI client
│   ├── summarize.ts        ← Summary generation
│   └── db.ts               ← Prisma client
├── prisma/
│   └── schema.prisma       ← Database schema
├── .env.local              ← Your secrets (not committed)
└── building_plan.md        ← Full technical spec
```

---

For questions or issues, see `building_plan.md` for the full technical specification.
