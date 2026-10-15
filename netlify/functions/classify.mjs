// Sorts a user's typed message into one of the assistant's scripted support paths.
// The Groq API key stays here on the server (set GROQ_API_KEY in Netlify), never in the page.

const FLOWS = ["setup", "bot", "template", "connect", "unknown"];

const SYSTEM_PROMPT = `You route messages for a WhatsApp chatbot setup assistant used by non-technical business owners.
Reply with JSON only, exactly: {"flow": "<label>"} where <label> is one of:
- setup: wants to create or set up a chatbot, or doesn't know how to start or configure one
- bot: an existing chatbot doesn't reply, stopped working, or replies wrongly
- template: a WhatsApp message template is rejected, stuck in review, or approved but not sending
- connect: trouble connecting or verifying a WhatsApp number (OTP, Facebook login, number already in use)
- unknown: anything else, such as billing, pricing, account access, unrelated or unclear messages
Never answer the user's question. Only output the JSON.`;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return json({ error: "not_configured" }, 500);

  let text = "";
  try { ({ text } = await req.json()); } catch { /* bad body */ }
  text = String(text || "").trim().slice(0, 500);
  if (!text) return json({ error: "empty_message" }, 400);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        temperature: 0,
        max_tokens: 20,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return json({ error: "groq_error", status: res.status }, 502);

    const data = await res.json();
    let flow = "unknown";
    try { flow = JSON.parse(data.choices[0].message.content).flow; } catch { /* keep unknown */ }
    if (!FLOWS.includes(flow)) flow = "unknown";
    return json({ flow });
  } catch {
    return json({ error: "timeout_or_network" }, 504);
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: "/api/classify" };
