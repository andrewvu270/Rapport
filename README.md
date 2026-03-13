# Rapport

AI-powered networking practice app. Upload an event or meeting context, get AI-generated person cards for each attendee, then practice real conversations via voice or video before you walk in the room.

## What it does

1. **Prep** — Paste a LinkedIn profile, event page, or any context about who you're meeting. Rapport extracts participants and builds a Person Card for each one with a profile summary, icebreakers, conversation openers, and follow-up questions.

2. **Practice** — Start a voice session (Vapi) or video session (Tavus) and have a live AI conversation as that person. Sessions are capped at 5 minutes.

3. **Debrief** — After the session ends, Claude grades your performance on openers, question quality, response relevance, and closing — and gives you actionable homework.

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js |
| Auth & DB | Supabase |
| Voice AI | Vapi |
| Video AI | Tavus |
| LLM | Claude, OpenAI |
| Vector search | Pinecone |
| UI | Tailwind CSS + Framer Motion |