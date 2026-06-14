# ProcureRocket - AI Tender Evaluation Platform

ProcureRocket is a React + TypeScript application for tender qualification workflows.  
It helps procurement teams upload tender/bidder documents, extract criteria, run AI-assisted eligibility decisions, review flagged items, and generate reports.

## Highlights

- Tender and bidder intake workflow
- OCR pipeline with server-side AI integration and local fallback
- AI evaluation with explainable decisions (`Eligible`, `Not Eligible`, `Review`)
- Manual review and decision override flow
- Decision analytics and reporting dashboards
- Demo intelligence views:
- `Smart Eligibility Radar`
- `Risk Heatmap`
- `Auto Workflow Preview`
- Demo header interactions:
- Bell icon notification dropdown
- Demo sign in/sign out user menu (localStorage-based)

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- Recharts
- React Router
- Express (API server)
- PostgreSQL (state + observability storage)
- AWS S3 (file storage)
- AWS Textract (OCR processing)
- OpenRouter (primary AI provider)
- AWS Bedrock (fallback AI provider)

## Application Routes

- `/` - Dashboard
- `/tender-upload` - Tender Upload
- `/bidder-upload` - Bidder Submissions
- `/evaluation` - AI Evaluation
- `/decision-summary` - Decision Summary
- `/report` - Detailed Report
- `/review` - Manual Review
- `/smart-eligibility-radar` - Smart Eligibility Radar
- `/risk-heatmap` - Risk Heatmap
- `/workflow-preview` - Auto Workflow Preview

## Architecture

- Frontend calls `src/lib/api.ts`.
- API server runs from `server/index.js`.
- Primary persistence is PostgreSQL with versioned state management.
- File storage is S3 via upload/signed-url endpoints.
- OCR processing uses AWS Textract with local fallback.
- AI evaluation uses OpenRouter as primary provider with Bedrock fallback.
- If API is unavailable, frontend gracefully falls back to local browser storage.

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Dashboard│ │  Upload  │ │Evaluation│ │  Review  │ │ Reports  │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       │            │            │            │            │         │
│       └────────────┴────────────┴────────────┴────────────┴─────────┘
│                            │                                         │
│                    ┌───────▼────────┐                               │
│                    │  API Client    │                               │
│                    │  (src/lib/api) │                               │
│                    └───────┬────────┘                               │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Express API     │
                    │  Server          │
                    │  (server/index)  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌──────▼──────┐
│   PostgreSQL   │  │     AWS S3      │  │  AI Services │
│                │  │                │  │              │
│  • app_state   │  │  • File Upload │  │  • Textract │
│  • ocr_results │  │  • Signed URLs │  │  • OpenRouter│
│  • evaluations │  │  • File Delete │  │  • Bedrock  │
│  • traces      │  │                │  │  • Sarvam   │
│  • upload_events│ │                │  │              │
└────────────────┘  └─────────────────┘  └──────────────┘

AI Provider Fallback Chain:
OpenRouter → Bedrock → Sarvam LLM → Deterministic Fallback

OCR Provider Fallback Chain:
AWS Textract → Sarvam OCR → Local Simulation
```

## Prerequisites

- Node.js 18+
- PostgreSQL instance (Aurora PostgreSQL recommended)
- S3 bucket (AWS S3 or S3-compatible provider)
- OpenRouter API key (for AI evaluation)
- AWS credentials (for S3, Textract, and Bedrock)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` in project root (example):

```env
# Frontend -> API
VITE_API_BASE_URL=http://localhost:8787
VITE_API_AUTH_TOKEN=replace_with_long_random_token

# API auth
API_AUTH_TOKEN=replace_with_same_long_random_token
API_PORT=8787

# Upload limits
MAX_UPLOAD_MB=50

# OCR / LLM
SARVAM_API_URL=https://api.sarvam.ai/v1/ocr
SARVAM_API_KEY=your_sarvam_ocr_key
SARVAM_LLM_API_URL=https://api.sarvam.ai/v1/chat/completions
SARVAM_LLM_API_KEY=your_sarvam_llm_key
SARVAM_USE_OCR_KEY_FOR_LLM=false
OPENROUTER_API_KEY=your_openrouter_key

# PostgreSQL
DATABASE_URL=postgresql://user:password@host:port/database

# AWS Services
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
S3_BIDDER_PREFIX=Bidder_Documents
S3_TENDER_PREFIX=Tendor_Policy_Doc
AWS_TEXTRACT_ENABLED=true
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0

# Optional for S3-compatible providers (e.g. MinIO)
# S3_ENDPOINT=http://127.0.0.1:9000
# S3_FORCE_PATH_STYLE=true
```

3. Run PostgreSQL migration:

```bash
node server/migrate-postgres.js
```

4. Start API server:

```bash
npm run dev:api
```

5. Start frontend (new terminal):

```bash
npm run dev
```

6. Open:

`http://localhost:5173`

## Scripts

- `npm run dev` - start Vite frontend
- `npm run dev:api` - start Express API server
- `npm run build` - production build
- `npm run preview` - preview built app
- `npm run lint` - ESLint checks
- `npm run typecheck` - TypeScript no-emit check

## API Endpoints (Key)

- `GET /health`
- `GET /health/deps`
- `GET /health/ai`
- `GET /api/state`
- `PUT /api/state`
- `POST /api/files/upload`
- `GET /api/files/signed-url`
- `DELETE /api/files`
- `POST /api/ocr`
- `POST /api/evaluate`
- `GET /api/evaluations/:tenderId`
- `GET /api/observability/summary`
- `GET /api/observability/records`

## Demo Flow

1. Create a tender from Dashboard or Tender Upload.
2. Upload tender doc and extract criteria.
3. Add bidders and upload bidder docs.
4. Run AI evaluation.
5. Review results in:
- `AI Evaluation`
- `Decision Summary`
- `Manual Review`
- `Detailed Report`
- `Smart Eligibility Radar`
- `Risk Heatmap`
- `Auto Workflow Preview`
6. Use top-right header:
- Bell icon for demo notifications
- User menu for demo sign in/sign out

## Security Notes

- Do not commit real secrets in `.env`.
- Keep `API_AUTH_TOKEN` enabled outside local demos.
- OCR/LLM keys are server-side and should never be exposed in frontend code.

## License

Internal use - Procurement Intelligence demo/project.
