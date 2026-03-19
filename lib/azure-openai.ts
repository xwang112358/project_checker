import OpenAI from "openai";
import { getSetting } from "./db";

type Provider = "azure" | "openai" | "anthropic" | "openrouter";

async function getProvider(): Promise<Provider> {
  const stored = await getSetting("ai_provider");
  return ((stored ?? process.env.AI_PROVIDER) as Provider) ?? "azure";
}

function getModel(provider: Provider): string {
  switch (provider) {
    case "azure":      return process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o-mini";
    case "openai":     return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    case "anthropic":  return process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-20241022";
    case "openrouter": return process.env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-haiku";
    default:           return "gpt-4o-mini";
  }
}

function getOpenAICompatClient(provider: Provider): OpenAI {
  if (provider === "azure") {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-08-01-preview";
    if (!endpoint || !apiKey || !deployment)
      throw new Error("Azure OpenAI credentials are not fully configured");
    return new OpenAI({
      apiKey,
      baseURL: `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}`,
      defaultQuery: { "api-version": apiVersion },
      defaultHeaders: { "api-key": apiKey },
    });
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    return new OpenAI({ apiKey });
  }

  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
    return new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
  }

  throw new Error(`Provider "${provider}" does not use an OpenAI-compatible client`);
}

const SYSTEM_PROMPT =
  "You are a concise research progress assistant. Summarize GitHub activity for a PhD student. Be specific and avoid vague filler phrases.";

export async function validateAzureCredentials(): Promise<{ model: string; provider: string }> {
  const provider = await getProvider();
  const model = getModel(provider);

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model,
      max_tokens: 5,
      messages: [{ role: "user", content: "Say OK" }],
    });
    return { model, provider };
  }

  const client = getOpenAICompatClient(provider);
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: "Say OK" }],
    max_tokens: 5,
  });
  return { model: res.model ?? model, provider };
}

export async function generateSummaryText(prompt: string): Promise<string> {
  const provider = await getProvider();
  const model = getModel(provider);

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content[0];
    return block.type === "text" ? block.text.trim() : "";
  }

  const client = getOpenAICompatClient(provider);
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_tokens: 300,
    temperature: 0.4,
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

export async function isAIConfigured(): Promise<boolean> {
  const provider = await getProvider();
  switch (provider) {
    case "azure":
      return !!(
        process.env.AZURE_OPENAI_ENDPOINT &&
        process.env.AZURE_OPENAI_API_KEY &&
        process.env.AZURE_OPENAI_DEPLOYMENT
      );
    case "openai":      return !!process.env.OPENAI_API_KEY;
    case "anthropic":   return !!process.env.ANTHROPIC_API_KEY;
    case "openrouter":  return !!process.env.OPENROUTER_API_KEY;
    default:            return false;
  }
}

// Backward-compat alias
export async function isAzureConfigured(): Promise<boolean> {
  return isAIConfigured();
}
