# Assist

A working prototype of an AI assistant inside a support operator's console, for a fictional mobile operator, Northline Mobile. All data is invented.

It shows three things an AI product has to get right before anyone trusts it with real accounts:

1. **Answers with evidence.** Every figure links to the record and line it came from. Selecting a numbered source opens that record beside the conversation.
2. **Actions with confirmation.** The assistant can propose credits, plan changes, packs and SMS. It never executes them itself. Each proposal is a card that states what changes for the customer and why.
3. **Autonomy per action type.** The operator decides, per type, whether the assistant may _do it_, must _ask_, or may _never_ do it. Credits have an amount limit: small ones go through, larger ones wait. The rule is checked on the server for every action, not in the prompt.

Plus an activity log of every read, proposal and decision.

## Scenarios

| Customer        | Question                                                             | What it demonstrates                                                                                                    |
| --------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Olena Kovalenko | Why is October's bill ₴430? → Is she eligible for a goodwill credit? | Evidence chain across invoice, usage, SMS and policy. A ₴90 credit above the ₴50 limit waits for confirmation           |
| Andrii Melnyk   | No network for three days                                            | Incident matched to his home area, compensation computed from policy, ₴45 credit applied automatically within the limit |
| Iryna Bondar    | She wants a cheaper plan                                             | The assistant holds back: the data can't tell whether the second SIM is still needed, and the saving depends on it      |

## Modes

- **Scripted** (no API key): the suggested questions run end to end through the same tools and autonomy rules. Used for local review.
- **Live** (`ANTHROPIC_API_KEY` set on the server): Claude (`claude-sonnet-5-5`, override with `ANTHROPIC_MODEL`) answers free-form questions with tool use. Read tools run directly; write tools only ever return a proposal, and the autonomy rule decides its fate. A system prompt requires a citation for every figure and forbids claiming an action is done unless the tool says so. A per-instance rate limit caps a public demo at 30 questions per 10 minutes.

The key is read only on the server and never reaches the browser.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS. Deployed on Vercel.

```
src/lib/data.ts             fictional accounts, invoices, usage, incidents, policies
src/lib/tools.ts            read tools and write tools → proposed actions
src/lib/autonomy.ts         the single rule that decides auto / ask / off
src/lib/scripted-engine.ts  model-free engine for review
src/lib/live-engine.ts      Claude tool loop, tool schemas, system prompt
src/app/api/chat/route.ts   streams NDJSON events to the console
src/components/             console, conversation, action cards, source panel
```

## Run locally

```bash
npm install
npm run dev
```

Prototype by [UX Bureau](https://uxbureau.pro).
