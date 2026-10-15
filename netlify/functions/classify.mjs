// Sorts a user's typed message into one of the assistant's scripted support paths.
// The Groq API key stays here on the server (set GROQ_API_KEY in Netlify), never in the page.

const FLOWS = ["setup", "bot", "template", "connect", "human", "sensitive", "unknown"];
const DEFAULT_MODEL = "openai/gpt-oss-20b";

const SYSTEM_PROMPT = `You route messages for a WhatsApp chatbot setup assistant used by non-technical business owners.
Choose exactly one label:
- setup: wants to create or set up a chatbot, or doesn't know how to start or configure one
- bot: an existing chatbot doesn't reply, stopped working, or replies wrongly
- template: a WhatsApp message template is rejected, stuck in review, or approved but not sending
- connect: trouble connecting or verifying a WhatsApp number (OTP, Facebook login, number already in use)
- human: asks to talk to a person, a support agent or the support team instead of the assistant
- sensitive: billing, charges, refunds, invoices, subscription changes, account access, passwords or security
- unknown: anything else, such as pricing questions, unrelated or unclear messages
If a message asks for a person, choose human even if it also describes a problem.
Never answer the user's question. Reply with only this JSON: {"flow": "<label>"}`;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Pull the label out of the model's reply, even if it adds extra text around the JSON.
function readFlow(content) {
  const text = String(content || "");
  const match = text.match(/\{[^{}]*\}/);
  if (match) {
    try { const f = JSON.parse(match[0]).flow; if (FLOWS.includes(f)) return f; } catch { /* fall through */ }
  }
  const word = FLOWS.find((f) => new RegExp(`\\b${f}\\b`, "i").test(text));
  return word || "unknown";
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return json({ error: "not_configured" }, 500);

  let text = "";
  try { ({ text } = await req.json()); } catch { /* bad body */ }
  text = String(text || "").trim().slice(0, 500);
  if (!text) return json({ error: "empty_message" }, 400);

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        // Reasoning models spend some tokens thinking before they answer, so allow room.
        max_completion_tokens: 400,
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) {
      // Pass Groq's short error message back (never the key) so problems are easy to diagnose.
      let detail = "";
      try { detail = (await res.json())?.error?.message || ""; } catch { /* no body */ }
      return json({ error: "groq_error", status: res.status, model, detail: detail.slice(0, 200) }, 502);
    }

    const data = await res.json();
    const flow = readFlow(data?.choices?.[0]?.message?.content);
    return json({ flow });
  } catch {
    return json({ error: "timeout_or_network" }, 504);
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: "/api/classify" };
