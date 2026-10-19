# AuraCare+

A full-stack Alexa+ hackathon prototype for Eleanor (78) and her daughter Priya. It combines a simulated Alexa+ senior experience with a self-hosted MCP contract, synthetic medication data, deterministic safety rules, and a caregiver-first dashboard.

## Run it

```bash
pnpm install
pnpm dev
```

Open the preview and switch between Senior view and Caregiver dashboard. `pnpm verify:mcp` prints the MCP tool contract verification output.

## Environment variables

Copy `.env.example` to your environment. `MCP_AUTH_TOKEN` protects `/mcp`; `AI_API_KEY` and `AI_MODEL` enable optional server-side AI summaries; `RESEND_API_KEY` enables email delivery; `CAREGIVER_EMAIL` is Priya's test inbox. Without optional keys, the UI remains clearly SIMULATED.

## Where MCP is used

`mcp.config.json` describes the endpoint. Tool definitions and safety helpers are in `server/tools.ts`, and the runtime client contract is in `lib/mcp-client.ts`. The UI ships with a visible, auditable MCP contract surface while backend wiring can be connected to the deployed `/mcp` endpoint. All tool responses must remain prescription-grounded and use human escalation for uncertainty.

```mermaid
graph LR
 UI[React simulated Alexa+ + caregiver dashboard] --> CLIENT[Real MCP client]
 CLIENT --> HTTP[/mcp Streamable HTTP]
 HTTP --> TOOLS[Zod validated tools]
 TOOLS --> DB[(SQLite synthetic data)]
 TOOLS --> AI[Optional server-side AI]
```

## Simulated components and limitations

The activity sensor, browser speech, Alexa device surface, unavailable email outbox, and demo scenarios are simulated in clearly labelled UI. Data is synthetic. This is not a medical device, does not diagnose, and never changes prescriptions.

## Responsible AI and privacy

AI is only a server-side assistant for structured SBAR wording and optional label extraction. Code performs exact normalized prescription matching, confidence thresholds, refusal filtering, and escalation. No clinical certification or medical advice claims are made.

## Demo checklist
https://auracare-omega.vercel.app/
