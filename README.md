# Cheerio Assistant (Netlify + Groq)

Clickable prototype of an AI setup assistant. When someone **types** a problem, a Groq model sorts it into one of the scripted support paths. Buttons, demo journeys, steps and the support ticket stay scripted. If the AI is unavailable, the page falls back to keyword matching automatically.

## What's in this folder

| File | What it does |
|---|---|
| `index.html` | The whole prototype page |
| `netlify/functions/classify.mjs` | Server function at `/api/classify`. Calls Groq with your secret key and returns one label: `setup`, `bot`, `template`, `connect`, `human`, `sensitive` or `unknown` |
| `netlify.toml` | Tells Netlify where the page and function are |

Your Groq key is only ever stored in Netlify's settings. It is never in the page, so visitors can't see it.

## Deploy (about 10 clicks, no coding)

### 1. Get a Groq API key
1. Go to https://console.groq.com and sign in.
2. Open **API Keys** → **Create API Key**. Copy it somewhere safe.

### 2. Put the folder on GitHub
1. Sign in at https://github.com → **New repository** → name it `cheerio-assistant` → **Create repository**.
2. Click **uploading an existing file**.
3. Unzip this folder and drag **everything inside it** (including the `netlify` folder) into the upload area → **Commit changes**.
   Check that `netlify/functions/classify.mjs` appears in the repo.

### 3. Connect it to Netlify
1. Sign in at https://app.netlify.com → **Add new project** → **Import an existing project** → **GitHub**.
2. Pick the `cheerio-assistant` repository. Leave the build settings as they are → **Deploy**.

### 4. Add your Groq key
1. In your Netlify project: **Project configuration** → **Environment variables** → **Add a variable**.
2. Key: `GROQ_API_KEY`  Value: your key from step 1 → **Create variable**.
3. Go to **Deploys** → **Trigger deploy** → **Deploy project** (the key only takes effect on a new deploy).

Optional: add `GROQ_MODEL` to use a different Groq model (default `openai/gpt-oss-20b`).

## Check the AI is working
1. Open your Netlify site link.
2. Type: `my verification code never arrives` and press Enter.
3. In the side panel, **Understood by** should say **AI (Groq)**.
   - If it says **Keyword matching**, the AI call failed. Check the variable name is exactly `GROQ_API_KEY`, then trigger a new deploy. Netlify → **Logs** → **Functions** → `classify` shows the error.

Good test messages: `how do I start a chatbot`, `my bot ghosts customers`, `Meta said no to my message`.

These always go straight to a person, with no troubleshooting first: asking for a person (`just connect me to a real person`) and billing or account issues (`I was charged twice`, `I want a refund`). A keyword rule catches common phrasings before the AI is called, so this works even when the AI is down; the AI catches the rest. **Understood by** shows **Rule (always goes to a person)** when the rule matched.

## Notes for reviewers
- This is a prototype. It is not connected to Cheerio's systems and creates no real tickets.
- Groq's free tier has rate limits. If many people test at once and the limit is hit, the page quietly falls back to keyword matching.
