import { groupDraftSchema, type GroupDraft } from "@turnout/shared";
import { parseGroupSentence } from "./heuristic.ts";

const instructions = `You turn one sentence describing a recurring gathering into a JSON group setup.
Fields (omit any you cannot infer): name (short, friendly), activity (one word), location,
weekday (0=Sunday..6=Saturday), startTime ("HH:MM" 24h), durationMinutes, cap (max participants).
Reply with JSON only.`;

/** Turns one sentence into a group draft with an Azure AI Foundry model, falling back to the rule-based parser. */
export async function draftGroupFromSentence(sentence: string): Promise<{ draft: GroupDraft; source: "ai" | "rules" }> {
  const endpoint = process.env.AZURE_AI_ENDPOINT;
  const apiKey = process.env.AZURE_AI_API_KEY;
  const model = process.env.AZURE_AI_DEPLOYMENT;
  if (endpoint && apiKey && model) {
    try {
      const res = await fetch(`${endpoint.replace(/\/$/, "")}/openai/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", "api-key": apiKey },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: sentence },
          ],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
      const body = (await res.json()) as { choices: { message: { content: string } }[] };
      const parsed = groupDraftSchema.safeParse(JSON.parse(body.choices[0]!.message.content));
      if (parsed.success) return { draft: parsed.data, source: "ai" };
    } catch (err) {
      console.warn("AI group setup failed, using rules", err);
    }
  }
  return { draft: parseGroupSentence(sentence), source: "rules" };
}
