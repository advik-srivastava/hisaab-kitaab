# hisaabकिताब — AI DEVELOPMENT RULES

## PRODUCT

hisaabकिताब is a Microsoft hackathon Accounts-Payable Exception Assistant.

Tagline:

Review exceptions. Not every invoice.

The MVP has three core capabilities:

1. Bulk CSV/XLSX analysis
2. Explainable exception and duplicate detection
3. Human review with audit history

Reliability is more important than feature count.

---

# TECHNOLOGY

Use only the existing project stack plus approved dependencies.

Core:

- Next.js
- React
- TypeScript
- Tailwind CSS

Approved additions:

- xlsx
- zod
- fast-fuzzy
- vitest

Do not add another framework, database or service without Advik's approval.

---

# OWNERSHIP

## CODEX OWNS

src/core/**
src/types/**
src/config/**
src/lib/**
tests/**

Codex may read UI files but must not redesign them.

## ANTIGRAVITY OWNS

src/app/**
src/components/**
public/**

Antigravity may read core and shared types but must not modify them.

---

# SHARED STATUS VALUES

AUTO_PASS

REVIEW

HIGH_RISK

---

# REVIEW ACTIONS

APPROVE

REJECT

MARK_NOT_DUPLICATE

---

# ARCHITECTURAL RULES

1. UI must not contain Accounts-Payable decision logic.

2. Financial/business logic belongs under src/core/.

3. Shared interfaces belong under src/types/.

4. Do not redefine shared interfaces inside components.

5. Financial control decisions must be deterministic.

6. No LLM may approve or reject invoices.

7. Fuzzy duplicate matches are REVIEW cases, never automatic rejection.

8. Every duplicate must identify matchedTransactionId.

9. Every reviewer action must create an audit event.

10. Preserve sourceFile, sourceSheet and sourceRow.

11. Do not refactor unrelated working files.

12. Do not rename folders without approval.

13. Do not install new dependencies without approval.

14. Implement the smallest solution satisfying the task.

---

# DO NOT BUILD YET

- chatbot
- AI agent
- fraud ML
- ERP integration
- Power BI
- authentication
- payment execution
- email workflow
- multi-stage approval
- vector database
- OCR/PDF processing
- external database

---

# CREDIT EFFICIENCY

Before working:

1. Read AGENTS.md.
2. Read PRODUCT_SPEC.md.
3. Read only files relevant to the task.

Do not inspect the entire repository unless necessary.

Do not redesign architecture.

Do not rewrite working code.

Do not refactor for appearance.

Do not implement optional functionality.

Do not produce lengthy explanations.

When the task is complete report only:

1. files changed
2. tests run
3. build result
4. blockers

Then stop.

---

# QUALITY GATE

Before claiming a coding task is complete:

npm run lint
npm test
npm run build

If a test script does not yet exist during the initial foundation phase,
configure it as instructed.

Never claim success if the required checks fail.