"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ExternalLink, Loader2, AlertCircle, Plus, Trash2, ArrowRight } from "lucide-react";
import clsx from "clsx";

type Step = 1 | 2 | 3 | 4 | 5;

interface Repo {
  owner: string;
  repo: string;
  name: string;
  visibility: string;
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 3 – GitHub token
  const [githubStatus, setGithubStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [githubUser, setGithubUser] = useState<{ login: string; avatarUrl: string } | null>(null);
  const [githubError, setGithubError] = useState("");

  // Step 4 – Azure OpenAI
  const [azureStatus, setAzureStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [azureModel, setAzureModel] = useState("");
  const [azureError, setAzureError] = useState("");

  // Step 5 – Repos
  const [repoInput, setRepoInput] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [addingRepo, setAddingRepo] = useState(false);
  const [repoError, setRepoError] = useState("");

  const validateGithub = async () => {
    setGithubStatus("loading");
    setGithubError("");
    try {
      const res = await fetch("/api/setup/validate/github", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setGithubUser({ login: data.login, avatarUrl: data.avatarUrl });
        setGithubStatus("ok");
      } else {
        setGithubError(data.error ?? "Validation failed");
        setGithubStatus("error");
      }
    } catch {
      setGithubError("Network error");
      setGithubStatus("error");
    }
  };

  const validateAzure = async () => {
    setAzureStatus("loading");
    setAzureError("");
    try {
      const res = await fetch("/api/setup/validate/azure", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setAzureModel(data.model);
        setAzureStatus("ok");
      } else {
        setAzureError(data.error ?? "Validation failed");
        setAzureStatus("error");
      }
    } catch {
      setAzureError("Network error");
      setAzureStatus("error");
    }
  };

  const addRepo = async () => {
    const trimmed = repoInput.trim();
    if (!trimmed) return;
    const parts = trimmed.replace("https://github.com/", "").split("/");
    if (parts.length < 2) {
      setRepoError("Enter in the format owner/repo");
      return;
    }
    const [owner, repo] = parts;
    setAddingRepo(true);
    setRepoError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });
      const data = await res.json();
      if (res.ok) {
        setRepos((prev) => [...prev, { owner, repo, name: data.name, visibility: data.visibility }]);
        setRepoInput("");
      } else {
        setRepoError(data.error ?? "Failed to add repo");
      }
    } catch {
      setRepoError("Network error");
    } finally {
      setAddingRepo(false);
    }
  };

  const removeRepo = async (r: Repo) => {
    setRepos((prev) => prev.filter((x) => x.owner !== r.owner || x.repo !== r.repo));
  };

  const stepLabel = ["Welcome", "GitHub Token", "Connect GitHub", "Azure OpenAI", "Add Repos"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Progress bar */}
        <div className="flex border-b border-gray-100">
          {stepLabel.map((label, i) => (
            <div
              key={i}
              className={clsx(
                "flex-1 py-3 text-center text-xs font-medium transition-colors",
                i + 1 === step
                  ? "bg-blue-600 text-white"
                  : i + 1 < step
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-300"
              )}
            >
              {i + 1 < step ? "✓" : i + 1}
            </div>
          ))}
        </div>

        <div className="p-8">
          {/* Step 1 – Welcome */}
          {step === 1 && (
            <div className="space-y-6 text-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">project_checker</h1>
                <p className="mt-2 text-gray-500">GitHub-based PhD project progress tracker</p>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                This tool reads your GitHub repos and uses AI to generate weekly and monthly
                progress summaries. It needs two things to get started:
              </p>
              <div className="text-left space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg">🔑</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">GitHub Personal Access Token</p>
                    <p className="text-xs text-gray-500">To read your repos (including private ones)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg">🤖</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Azure OpenAI credentials</p>
                    <p className="text-xs text-gray-500">To generate AI-powered summaries</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Get started <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Step 2 – GitHub token guide */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Create a GitHub token</h2>
                <p className="text-sm text-gray-500 mt-1">Follow these steps, then come back here.</p>
              </div>
              <ol className="space-y-3 text-sm text-gray-700">
                {[
                  <>Go to <strong>GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens</strong></>,
                  <>Click <strong>"Generate new token"</strong></>,
                  <>Set name: <code className="bg-gray-100 px-1 rounded">project-checker</code>, expiration: 1 year</>,
                  <>Under <strong>Repository access</strong>, choose <strong>"All repositories"</strong></>,
                  <>Under <strong>Permissions</strong>, enable <strong>Contents, Pull requests, Issues, Metadata</strong> → all Read-only</>,
                  <>Click <strong>"Generate token"</strong> and copy it</>,
                  <>Add it to your <code className="bg-gray-100 px-1 rounded">.env.local</code> file as <code className="bg-gray-100 px-1 rounded">GITHUB_PAT=...</code></>,
                ].map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <ExternalLink size={14} />
                Open GitHub token creation page
              </a>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                  Back
                </button>
                <button onClick={() => setStep(3)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors">
                  I&apos;ve created my token
                </button>
              </div>
            </div>
          )}

          {/* Step 3 – Validate GitHub token */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Connect GitHub</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Make sure <code className="bg-gray-100 px-1 rounded">GITHUB_PAT</code> is set in{" "}
                  <code className="bg-gray-100 px-1 rounded">.env.local</code>, then restart the dev server and click Validate.
                </p>
              </div>

              {githubStatus === "ok" && githubUser && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={githubUser.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Connected as @{githubUser.login}</p>
                    <p className="text-xs text-green-600">Token is valid</p>
                  </div>
                  <CheckCircle size={18} className="ml-auto text-green-500" />
                </div>
              )}

              {githubStatus === "error" && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{githubError}</span>
                </div>
              )}

              <button
                onClick={validateGithub}
                disabled={githubStatus === "loading" || githubStatus === "ok"}
                className={clsx(
                  "w-full py-3 font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition-colors",
                  githubStatus === "ok"
                    ? "bg-green-100 text-green-700 cursor-default"
                    : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white"
                )}
              >
                {githubStatus === "loading" && <Loader2 size={14} className="animate-spin" />}
                {githubStatus === "ok" ? "✓ Validated" : "Validate token"}
              </button>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={githubStatus !== "ok"}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 4 – Azure OpenAI */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Configure Azure OpenAI</h2>
                <p className="text-sm text-gray-500 mt-1">Add these to your <code className="bg-gray-100 px-1 rounded">.env.local</code> file and restart the server.</p>
              </div>

              <div className="space-y-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-4 font-mono">
                <p>AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com</p>
                <p>AZURE_OPENAI_API_KEY=your-key</p>
                <p>AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini</p>
                <p>AZURE_OPENAI_API_VERSION=2024-08-01-preview</p>
              </div>

              <a
                href="https://portal.azure.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <ExternalLink size={14} />
                Open Azure Portal
              </a>

              {azureStatus === "ok" && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle size={16} className="text-green-500" />
                  <p className="text-sm text-green-700 font-medium">Connected · {azureModel}</p>
                </div>
              )}
              {azureStatus === "error" && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{azureError}</span>
                </div>
              )}

              <button
                onClick={validateAzure}
                disabled={azureStatus === "loading" || azureStatus === "ok"}
                className={clsx(
                  "w-full py-3 font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition-colors",
                  azureStatus === "ok"
                    ? "bg-green-100 text-green-700 cursor-default"
                    : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white"
                )}
              >
                {azureStatus === "loading" && <Loader2 size={14} className="animate-spin" />}
                {azureStatus === "ok" ? "✓ Connected" : "Test connection"}
              </button>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                  Back
                </button>
                <button
                  onClick={() => setStep(5)}
                  disabled={azureStatus !== "ok"}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 5 – Add repos */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add your repos</h2>
                <p className="text-sm text-gray-500 mt-1">Enter repos in the format <code className="bg-gray-100 px-1 rounded">owner/repo</code></p>
              </div>

              <div className="flex gap-2">
                <input
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRepo()}
                  placeholder="myusername/my-research-repo"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                />
                <button
                  onClick={addRepo}
                  disabled={addingRepo || !repoInput.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
                >
                  {addingRepo ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                </button>
              </div>

              {repoError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle size={12} /> {repoError}
                </p>
              )}

              {repos.length > 0 && (
                <ul className="space-y-2">
                  {repos.map((r) => (
                    <li key={`${r.owner}/${r.repo}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{r.owner}/{r.repo}</p>
                        <p className="text-xs text-gray-400">{r.visibility}</p>
                      </div>
                      <button onClick={() => removeRepo(r)} className="text-gray-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(4)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                  Back
                </button>
                <button
                  onClick={() => router.push("/")}
                  disabled={repos.length === 0}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  Go to dashboard →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
