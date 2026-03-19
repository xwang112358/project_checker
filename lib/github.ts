import { Octokit } from "@octokit/rest";

function getOctokit(): Octokit {
  const token = process.env.GITHUB_PAT;
  if (!token) throw new Error("GITHUB_PAT is not set");
  return new Octokit({ auth: token });
}

export interface RepoInfo {
  visibility: "public" | "private";
  description: string | null;
  defaultBranch: string;
  pushedAt: string | null;
}

export interface CommitData {
  sha: string;
  author: string;
  message: string;
  date: Date;
}

export interface PRData {
  githubPrId: number;
  title: string;
  status: "open" | "merged" | "closed";
  openedAt: Date;
  mergedAt: Date | null;
  closedAt: Date | null;
}

export interface IssueData {
  githubIssueId: number;
  title: string;
  status: "open" | "closed";
  openedAt: Date;
  closedAt: Date | null;
}

export interface RateLimit {
  remaining: number;
  limit: number;
  resetAt: Date;
}

export async function validateToken(): Promise<{ login: string; avatarUrl: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.users.getAuthenticated();
  return { login: data.login, avatarUrl: data.avatar_url };
}

export async function getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.get({ owner, repo });
  return {
    visibility: data.private ? "private" : "public",
    description: data.description,
    defaultBranch: data.default_branch,
    pushedAt: data.pushed_at,
  };
}

export async function fetchCommitsSince(
  owner: string,
  repo: string,
  since: Date | null,
  sha?: string
): Promise<CommitData[]> {
  const octokit = getOctokit();
  const commits: CommitData[] = [];
  let page = 1;

  while (true) {
    const params: Parameters<typeof octokit.rest.repos.listCommits>[0] = {
      owner,
      repo,
      per_page: 100,
      page,
    };
    if (since) params.since = since.toISOString();
    if (sha) params.sha = sha;

    const { data } = await octokit.rest.repos.listCommits(params);
    if (data.length === 0) break;

    for (const c of data) {
      commits.push({
        sha: c.sha,
        author: c.commit.author?.name ?? c.author?.login ?? "unknown",
        message: c.commit.message.split("\n")[0].slice(0, 200),
        date: new Date(c.commit.author?.date ?? Date.now()),
      });
    }

    if (data.length < 100) break;
    page++;
    if (page > 10) break; // cap at 1000 commits
  }

  return commits;
}

export async function fetchCommitsAllBranches(
  owner: string,
  repo: string,
  since: Date | null
): Promise<{ commits: CommitData[]; branches: string[] }> {
  const octokit = getOctokit();
  const { data: branchData } = await octokit.rest.repos.listBranches({
    owner,
    repo,
    per_page: 30,
  });
  const branches = branchData.map((b) => b.name);

  // Always look back at least 35 days so branches not previously synced
  // don't miss commits that predate lastSyncedAt.
  const lookbackFloor = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  const effectiveSince = since && since > lookbackFloor ? lookbackFloor : since;

  const seen = new Set<string>();
  const commits: CommitData[] = [];

  for (const branch of branches) {
    const branchCommits = await fetchCommitsSince(owner, repo, effectiveSince, branch);
    for (const c of branchCommits) {
      if (!seen.has(c.sha)) {
        seen.add(c.sha);
        commits.push(c);
      }
    }
  }

  return { commits, branches };
}

export async function fetchPRsSince(
  owner: string,
  repo: string,
  since: Date | null
): Promise<PRData[]> {
  const octokit = getOctokit();
  const prs: PRData[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: 100,
      page,
    });

    if (data.length === 0) break;

    let reachedOld = false;
    for (const pr of data) {
      const updatedAt = new Date(pr.updated_at);
      if (since && updatedAt < since) {
        reachedOld = true;
        break;
      }
      prs.push({
        githubPrId: pr.number,
        title: pr.title,
        status: pr.merged_at ? "merged" : pr.state === "closed" ? "closed" : "open",
        openedAt: new Date(pr.created_at),
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      });
    }

    if (reachedOld || data.length < 100) break;
    page++;
    if (page > 5) break;
  }

  return prs;
}

export async function fetchIssuesSince(
  owner: string,
  repo: string,
  since: Date | null
): Promise<IssueData[]> {
  const octokit = getOctokit();
  const issues: IssueData[] = [];
  let page = 1;

  while (true) {
    const params: Parameters<typeof octokit.rest.issues.listForRepo>[0] = {
      owner,
      repo,
      state: "all",
      per_page: 100,
      page,
    };
    if (since) params.since = since.toISOString();

    const { data } = await octokit.rest.issues.listForRepo(params);
    if (data.length === 0) break;

    for (const issue of data) {
      if (issue.pull_request) continue; // GitHub issues API includes PRs; skip them
      issues.push({
        githubIssueId: issue.number,
        title: issue.title,
        status: issue.state === "open" ? "open" : "closed",
        openedAt: new Date(issue.created_at),
        closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
      });
    }

    if (data.length < 100) break;
    page++;
    if (page > 5) break;
  }

  return issues;
}

export async function getRateLimit(): Promise<RateLimit> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.rateLimit.get();
  return {
    remaining: data.rate.remaining,
    limit: data.rate.limit,
    resetAt: new Date(data.rate.reset * 1000),
  };
}
