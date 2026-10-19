# AuraCare+

An ambient, voice-first companion for seniors living alone, built for the Amazon Alexa+ hackathon track. AuraCare+ is a simulated Alexa+ web experience for Elenor, with her caregiver Esther as a call-for-help contact, a medication reminder workflow, and deterministic safety rules.

- **Live demo:** https://auracare-omega.vercel.app/

## What it does

- **Hands-free voice conversation:** say "Aura" to start; live transcription appears in the text field and is sent automatically when you stop speaking. Replies are spoken aloud.
- **Medication reminders:** a medication card (name, dose, time) backed by SQLite, an add-reminder form, and an audible reminder alarm.
- **Safety rules:** requests to change, skip, or double a dose, or to get a diagnosis, get a fixed refusal and are redirected to the care team. Emergency phrases (falls, chest pain, trouble breathing) trigger clear "call emergency services and Esther" guidance.
- **Camera check-in:** turn the camera on or off with the button or by voice ("Aura, turn the camera on"). The camera shows a live preview only; no video is recorded or analyzed.
- **Call Esther:** a simulated caregiver call flow (UI and voice feedback only; no real call is placed).
- **Activity feed and demo mode:** an interactive demo panel with a live event stream of what Aura is doing.
- **Senior-friendly design:** large controls, high contrast, plain language, typed input as a fallback when voice isn't available.

## Run it locally

**Prerequisites:** Node.js 20.9 or newer and pnpm [CONFIRM VERSION].

```bash
git clone https://github.com/V-S-AISHWARYA/AuraCarePlus_agent
cd V-S-AISHWARYA/AuraCarePlus_agent
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000.

- **Browser:** voice features use the Web Speech API and work best in Chrome or Edge. Allow microphone (and camera) access when prompted. Without speech support, use the text box.
- **Database:** a local SQLite file (`auracare.sqlite`) is created and seeded automatically on first run with three synthetic medications.
- **No API keys needed:** conversational AI replies use Vercel AI Gateway; without gateway credentials the app falls back to built-in replies and keeps working.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `MCP_AUTH_TOKEN` | Optional bearer token for the MCP endpoint |
| `NEXT_PUBLIC_APP_URL` | Optional base URL used when the app checks its MCP endpoint (defaults to http://localhost:3000) |

## Alexa+ and MCP

For the Alexa+ track we chose the **simulated Alexa+ experience** option: a web app that shows how a senior-focused Alexa+ companion would behave.

The capabilities are defined as an MCP tool contract in `server/tools.ts` (Zod-validated inputs): `get_medication_status`, `log_dose`, `verify_pill_bottle`, `report_symptom`, `check_risk_and_escalate`, `get_companion_context`, and `get_adherence_summary`. `mcp.config.json` describes the target endpoint (protocol version 2025-11-25, Streamable HTTP).

**Current status:** the tool contract and safety helpers are implemented. The project is in the current demo the UI uses the app's API routes (`/api/assistant`, `/api/medications`, `/api/caretaker`) directly. Serving these tools from `/mcp` with the official MCP TypeScript SDK is the next step.

## Architecture

```mermaid
graph LR
  UI[React: simulated Alexa+ senior UI] --> ASSIST[/api/assistant]
  UI --> MEDS[/api/medications]
  ASSIST --> SAFE[Safety rules: refusal and escalation]
  SAFE --> AI[AI Gateway model or built-in fallbacks]
  MEDS --> DB[(SQLite synthetic data)]
  CONTRACT[MCP tool contract: server/tools.ts] -. next step .-> MCP[/mcp Streamable HTTP/]
```

## Simulated components and limitations

The Alexa+ device surface, the caregiver call, and the demo scenarios are simulated. All data is synthetic. AuraCare+ is a wellness assistant, not a medical device. It does not diagnose and never changes prescriptions.

## Responsible AI and privacy

- Safety checks run in code before any AI call: unsafe medication or diagnosis requests get a fixed refusal, and the AI is never asked to answer them.
- The AI is instructed to avoid diagnosis, dose changes, and emergency medical advice, and to direct emergencies to local emergency services and Esther.
- AI calls have a timeout, and built-in replies keep the app useful when the AI service is unavailable.
- No real personal or health data is used. Camera video stays in the browser.

## Tech stack

Next.js 16, React 19, TypeScript, Tailwind CSS, Web Speech API, MediaDevices API, SQLite (better-sqlite3), Zod, Vercel AI SDK with AI Gateway, MCP TypeScript SDK (tool contract), deployed on Vercel.

## License

Released under the MIT License.
