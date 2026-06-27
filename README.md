<div align="center">

# 🚀 ProcureRocket

### AI Tender Intelligence Platform

**AWS Databases + Vercel Hackathon · Track 2 — Monetizable B2B Application**

[![AWS Aurora PostgreSQL](https://img.shields.io/badge/AWS-Aurora_PostgreSQL-4479A1?style=for-the-badge&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/rds/aurora/)
[![Vercel](https://img.shields.io/badge/Vercel-Frontend-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![React](https://img.shields.io/badge/React_18-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock_AI-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/bedrock/)

*Turning India's ₹50–70 lakh crore procurement ecosystem from PDF checklists into AI-powered decisions — with Aurora PostgreSQL as the single source of truth.*

</div>

---

## 📌 The Problem

India's public procurement market processes **₹50–70 lakh crore annually** (~20–22% of GDP), yet evaluation still runs on manual PDF review, spreadsheets, and human judgment.

| Metric | Reality |
|--------|---------|
| 📅 Per-tender evaluation time | **4–9 weeks** from bid submission to contract award |
| 💸 Forged-document contracts awarded | **₹255+ crore** flagged in a single state audit |
| 📄 Backdated bid submissions found | **6.26 lakh+** filed before their own tender even existed |
| 📦 GeM orders in FY 2025–26 | **75.7 lakh orders** worth ₹5 lakh crore — all needing evaluation |

> **ProcureRocket closes this gap** — AI-assisted eligibility decisions, explainable outcomes, full audit trails, and a tamper-proof system of record in Aurora PostgreSQL.

---

## 🏗️ System Architecture

> Aurora PostgreSQL sits at the center of every data flow — all tenders, bidder submissions, OCR results, AI evaluations, decisions, and audit logs are persisted there as the single system of record.

![Architecture Diagram](https://github.com/user-attachments/assets/c06e88f8-2364-4342-a2ce-d8ca53803918)



## 🎥 Demo Video

[![ProcureRocket Demo](https://img.youtube.com/vi/cspJOnABpXM/maxresdefault.jpg)](https://youtu.be/cspJOnABpXM)

> Click to watch the walkthrough

### Architecture at a Glance

```
Browser / Vercel (React + Vite)
        │  HTTPS + JWT
        ▼
Express API  ──── AWS Secrets Manager (keys & config)
   │    │
   │    ├──► S3 (tender docs, bidder docs, generated reports)
   │    │         │
   │    │         └──► AWS Textract (OCR)  ──fallback──► Sarvam OCR
   │    │                   │
   │    │         EventBridge + SQS (event-driven, retry + DLQ)
   │    │
   │    ├──► OpenRouter (Claude / GPT / Gemini)  ──fallback──► AWS Bedrock
   │    │         └──► deterministic Rule Engine (final fallback)
   │    │
   │    └──► ★ Aurora PostgreSQL ★  (System of Record)
   │              ├─ tenders & criteria
   │              ├─ bidder submissions
   │              ├─ OCR structured output
   │              ├─ AI evaluation scores & decisions
   │              ├─ manual review overrides
   │              └─ full audit trail + observability logs
   │
   └──► CloudWatch (metrics, alarms, logs across all tiers)
```

![Data Flow Detail](https://github.com/user-attachments/assets/07dfa4a4-a2d5-4ddf-85d2-6c8978eca9f6)

---

## ☁️ AWS Services — Deep Dive

### ★ Amazon Aurora PostgreSQL — Primary System of Record

Aurora PostgreSQL is not just a database here — it is the backbone of every decision ProcureRocket makes.

| Concern | Implementation |
|---------|----------------|
| **Schema** | Tenders · Bidders · Submissions · OCR results · Evaluations · Reports · Audit logs |
| **Durability** | Multi-AZ Aurora cluster with automatic failover |
| **Scale** | Serverless v2 auto-scaling — zero idle cost, instant burst |
| **Security** | Encrypted at rest (AWS KMS) · encrypted in transit · VPC private subnets |
| **Audit** | Every AI decision, human override, and status change written as immutable audit rows |
| **Observability** | `observability_records` table feeds the in-app metrics dashboard |

### AWS Textract — Document Intelligence

Primary OCR for all uploaded PDFs (tender documents, bidder certificates, financial statements). Outputs structured JSON that is stored in Aurora and used directly by the AI evaluation engine. Sarvam OCR serves as the automatic fallback if Textract is unavailable.

### AWS S3 — Document Storage

Three logical prefixes per deployment:
- `Tendor_Policy_Doc/` — tender specifications and addenda
- `Bidder_Documents/` — all bidder submission packages
- `generated-reports/` — final evaluation reports

All objects are versioned, server-side encrypted, and accessed only via short-lived signed URLs.

### AWS Bedrock — AI Fallback

When OpenRouter is unavailable, the evaluation engine automatically fails over to Bedrock (`anthropic.claude-3-5-sonnet-20240620-v1:0` by default, also supports Nova Pro and Titan). A deterministic rule engine handles edge cases as the final safety net.





---

## ✨ Features

**Tender Intake**
- Upload tender PDFs → Textract OCR → auto-extract eligibility criteria
- Store structured criteria in Aurora for downstream evaluation

**Bidder Management**
- Multi-bidder submission intake with document versioning
- OCR pipeline with primary/fallback routing and retry logic

**AI Evaluation Engine**
- Explainable decisions: `Eligible` · `Not Eligible` · `Review`
- Confidence scoring, risk flags, and winner recommendation
- Three-tier AI fallback: OpenRouter → Bedrock → Rule Engine
- All outputs persisted to Aurora with full provenance

**Manual Review & Override**
- Procurement officers can review `Review`-flagged items
- Human overrides recorded as audit events (immutable, timestamped)

**Decision Intelligence Views**
- 📡 **Smart Eligibility Radar** — multi-criteria radar chart per bidder
- 🔥 **Risk Heatmap** — cross-bidder risk surface visualisation
- ⚙️ **Auto Workflow Preview** — see the full evaluation pipeline state

**Reporting & Analytics**
- Detailed report per tender with per-bidder breakdown
- Decision summary with aggregate statistics
- Observability dashboard (AI latency, OCR fallback rates, error counts)

---

## 🛣️ Application Routes

| Route | View |
|-------|------|
| `/` | Dashboard |
| `/tender-upload` | Tender Upload & Criteria Extraction |
| `/bidder-upload` | Bidder Submissions |
| `/evaluation` | AI Evaluation Runner |
| `/decision-summary` | Decision Summary |
| `/report` | Detailed Report |
| `/review` | Manual Review Queue |
| `/smart-eligibility-radar` | Smart Eligibility Radar |
| `/risk-heatmap` | Risk Heatmap |
| `/workflow-preview` | Auto Workflow Preview |

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS |
| **State** | Zustand |
| **Charts** | Recharts |
| **Routing** | React Router |
| **Hosting** | Vercel |
| **API** | Node.js · Express |
| **Database** | Amazon Aurora PostgreSQL (Serverless v2) |
| **File Storage** | AWS S3 |
| **OCR (primary)** | AWS Textract |
| **OCR (fallback)** | Sarvam OCR |
| **AI (primary)** | OpenRouter (Claude · GPT · Gemini) |
| **AI (fallback)** | AWS Bedrock (Claude · Nova Pro · Titan) |
| **Container** | AWS ECS Fargate |
| **Events** | AWS EventBridge + SQS |
| **Observability** | Amazon CloudWatch |
| **Security** | AWS IAM · Secrets Manager · KMS · VPC |

---

## ⚙️ Setup

### Prerequisites

- Node.js 18+
- PostgreSQL / Amazon Aurora PostgreSQL instance
- AWS account with permissions for: S3, Textract, Bedrock, ECS, Secrets Manager, KMS
- OpenRouter API key

### 1 · Install dependencies

```bash
npm install
```

### 2 · Configure environment

Create `.env` in the project root:

```env
# ── Frontend → API ─────────────────────────────────────────────
VITE_API_BASE_URL=http://localhost:8787
VITE_API_AUTH_TOKEN=replace_with_long_random_token

# ── API Auth ────────────────────────────────────────────────────
API_AUTH_TOKEN=replace_with_same_long_random_token
API_PORT=8787

# ── Upload Limits ───────────────────────────────────────────────
MAX_UPLOAD_MB=50

# ── Aurora PostgreSQL ───────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/procurerocket

# ── AWS (S3 · Textract · Bedrock · ECS) ────────────────────────
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
S3_BIDDER_PREFIX=Bidder_Documents
S3_TENDER_PREFIX=Tendor_Policy_Doc
AWS_TEXTRACT_ENABLED=true
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0

# ── AI Providers ────────────────────────────────────────────────
OPENROUTER_API_KEY=your_openrouter_key

# ── OCR Fallback (Sarvam) ───────────────────────────────────────
SARVAM_API_URL=https://api.sarvam.ai/v1/ocr
SARVAM_API_KEY=your_sarvam_ocr_key
SARVAM_LLM_API_URL=https://api.sarvam.ai/v1/chat/completions
SARVAM_LLM_API_KEY=your_sarvam_llm_key
SARVAM_USE_OCR_KEY_FOR_LLM=false

# ── Optional: S3-compatible provider (e.g. MinIO for local dev) ─
# S3_ENDPOINT=http://127.0.0.1:9000
# S3_FORCE_PATH_STYLE=true
```

### 3 · Run Aurora database migration

```bash
node server/migrate-postgres.js
```

### 4 · Start the API server

```bash
npm run dev:api
```

### 5 · Start the frontend (new terminal)

```bash
npm run dev
```

### 6 · Open

```
http://localhost:5173
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | API liveness check |
| `GET` | `/health/deps` | Database + S3 connectivity check |
| `GET` | `/health/ai` | OpenRouter + Bedrock reachability |
| `GET` | `/api/state` | Full application state from Aurora |
| `PUT` | `/api/state` | Update application state in Aurora |
| `POST` | `/api/files/upload` | Upload tender or bidder document to S3 |
| `GET` | `/api/files/signed-url` | Generate pre-signed download URL |
| `DELETE` | `/api/files` | Remove file from S3 |
| `POST` | `/api/ocr` | Trigger Textract OCR (with Sarvam fallback) |
| `POST` | `/api/evaluate` | Run AI evaluation and persist to Aurora |
| `GET` | `/api/evaluations/:tenderId` | Fetch all evaluations for a tender from Aurora |
| `GET` | `/api/observability/summary` | Aggregated metrics from Aurora observability table |
| `GET` | `/api/observability/records` | Raw observability event log from Aurora |

---

## 🎬 Demo Flow

1. **Create a tender** from the Dashboard or Tender Upload page
2. **Upload the tender document** → Textract extracts eligibility criteria → stored in Aurora
3. **Add bidders** and upload their proposal documents → OCR pipeline runs
4. **Run AI Evaluation** → scores, risk flags, and decisions written to Aurora
5. **Review results** across:
   - AI Evaluation · Decision Summary · Manual Review · Detailed Report
   - Smart Eligibility Radar · Risk Heatmap · Auto Workflow Preview
6. **Use the header controls**: bell icon for notifications · user menu for sign-in/sign-out (localStorage demo session)

---

## 🔐 Security Notes

- Never commit real secrets to `.env` — use AWS Secrets Manager in production
- Keep `API_AUTH_TOKEN` enabled in all non-local environments
- OCR and LLM API keys are server-side only and never exposed to the frontend
- Aurora is deployed in VPC private subnets with no public endpoint
- All S3 access uses short-lived signed URLs — no public bucket ACLs

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite frontend dev server |
| `npm run dev:api` | Start Express API server |
| `npm run build` | Production build |
| `npm run preview` | Preview built app locally |
| `npm run lint` | ESLint checks |
| `npm run typecheck` | TypeScript type check (no emit) |

---

## 📄 License

Internal use — ProcureRocket Procurement Intelligence · AWS Databases + Vercel Hackathon submission.
