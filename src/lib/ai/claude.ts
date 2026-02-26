import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ClaudeCallParams {
  system: string;
  user: string;
  maxTokens?: number;
}

export async function callClaude(params: ClaudeCallParams): Promise<string> {
  const start = Date.now();

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: [{ role: "user", content: params.user }],
  });

  const duration = Date.now() - start;
  console.log(
    `[AI] Claude call: ${duration}ms, input=${response.usage.input_tokens} output=${response.usage.output_tokens}`
  );

  return response.content[0].type === "text" ? response.content[0].text : "";
}
