// Shared handler: proxies a chat turn to the Anthropic API using a
// server-side API key. Used by both the Express server (server/index.js)
// and the Vercel serverless function (api/coach.js) so the logic lives
// in exactly one place.

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1000;
const MAX_MESSAGES = 40; // guard against runaway/abusive threads
const MAX_SYSTEM_CHARS = 20000;
const MAX_MESSAGE_CHARS = 4000;

function badRequest(res, message) {
  res.status(400).json({ error: message });
}

async function handleCoachRequest(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set");
    res.status(500).json({ error: "Server is not configured" });
    return;
  }

  const { system, messages } = req.body || {};

  if (typeof system !== "string" || system.length === 0) {
    return badRequest(res, "Missing 'system' string");
  }
  if (system.length > MAX_SYSTEM_CHARS) {
    return badRequest(res, "System prompt too long");
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return badRequest(res, "Missing 'messages' array");
  }
  if (messages.length > MAX_MESSAGES) {
    return badRequest(res, "Conversation too long");
  }
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) {
      return badRequest(res, "Invalid message role");
    }
    if (typeof m.content !== "string" || m.content.length > MAX_MESSAGE_CHARS) {
      return badRequest(res, "Invalid or oversized message content");
    }
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error("Anthropic API error", upstream.status, data);
      res.status(502).json({ error: "Upstream API error" });
      return;
    }

    // Pass through only what the frontend needs.
    res.status(200).json({ content: data.content || [] });
  } catch (err) {
    console.error("Coach proxy error", err);
    res.status(502).json({ error: "Failed to reach the coach" });
  }
}

module.exports = { handleCoachRequest };
