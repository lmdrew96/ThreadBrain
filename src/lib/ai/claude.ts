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

/**
 * Call Claude with assistant prefill to force a specific response format.
 * Prefill text is prepended to the response — caller must account for this.
 */
export async function callClaudeWithPrefill(
  params: ClaudeCallParams & { prefill: string }
): Promise<string> {
  const start = Date.now();

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: [
      { role: "user", content: params.user },
      { role: "assistant", content: params.prefill },
    ],
  });

  const duration = Date.now() - start;
  console.log(
    `[AI] Claude call (prefill): ${duration}ms, input=${response.usage.input_tokens} output=${response.usage.output_tokens}`
  );

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return params.prefill + text;
}

/**
 * Call Claude expecting a JSON response. Uses prefill to force valid JSON,
 * strips code fences, and parses the result. Returns typed data.
 */
export async function callClaudeJson<T>(
  params: ClaudeCallParams & { prefill?: string }
): Promise<T> {
  const raw = await callClaudeWithPrefill({
    ...params,
    prefill: params.prefill ?? "[",
  });

  // Strip markdown code fences if the model wrapped the JSON
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  return JSON.parse(text) as T;
}

/**
 * Stream Claude response with prefill, yielding complete top-level JSON objects
 * from a JSON array as they arrive. This lets us send chunks to the client
 * as soon as each one is fully generated, instead of waiting for the entire response.
 */
export async function streamClaudeJsonArray(
  params: ClaudeCallParams & { prefill: string },
  onObject: (obj: unknown) => Promise<void>
): Promise<void> {
  const start = Date.now();

  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: [
      { role: "user", content: params.user },
      { role: "assistant", content: params.prefill },
    ],
  });

  let buffer = params.prefill;
  let depth = 0;
  let inString = false;
  let escape = false;
  let objectStart = -1;

  for await (const event of stream) {
    if (
      event.type !== "content_block_delta" ||
      event.delta.type !== "text_delta"
    )
      continue;

    const text = event.delta.text;

    for (const char of text) {
      buffer += char;

      if (escape) {
        escape = false;
        continue;
      }

      if (char === "\\" && inString) {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === "{") {
        if (depth === 0) {
          objectStart = buffer.length - 1;
        }
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0 && objectStart >= 0) {
          const objectStr = buffer.slice(objectStart);
          try {
            const obj = JSON.parse(objectStr);
            await onObject(obj);
          } catch {
            // Incomplete or invalid — will be caught in final parse
          }
          objectStart = -1;
        }
      }
    }
  }

  const finalMessage = await stream.finalMessage();
  const duration = Date.now() - start;
  console.log(
    `[AI] Claude stream: ${duration}ms, input=${finalMessage.usage.input_tokens} output=${finalMessage.usage.output_tokens}`
  );
}
