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
- MongoDB (state + observability storage)
- AWS S3 (file storage)

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
- Primary persistence is MongoDB (`/api/state` optimistic versioned writes).
- File storage is S3 via upload/signed-url endpoints.
- OCR/evaluation use server-side providers when configured.
- If API is unavailable, frontend gracefully falls back to local browser storage.

## Prerequisites

- Node.js 18+
- MongoDB instance
- S3 bucket (AWS S3 or S3-compatible provider)

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

# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=tendereval
MONGODB_STATE_COLLECTION=app_state
MONGODB_STATE_DOC_ID=current
MONGODB_OCR_COLLECTION=ocr_results
MONGODB_TENDER_OCR_COLLECTION=tender_policy_ocr
MONGODB_BIDDER_OCR_COLLECTION=bidder_document_ocr
MONGODB_EVALUATIONS_COLLECTION=evaluations
MONGODB_EVALUATION_TRACES_COLLECTION=evaluation_traces
MONGODB_UPLOAD_EVENTS_COLLECTION=upload_events

# S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
S3_BIDDER_PREFIX=Bidder_Documents
S3_TENDER_PREFIX=Tendor_Policy_Doc

# Optional for S3-compatible providers (e.g. MinIO)
# S3_ENDPOINT=http://127.0.0.1:9000
# S3_FORCE_PATH_STYLE=true
```

3. Start API server:

```bash
npm run dev:api
```

4. Start frontend (new terminal):

```bash
npm run dev
```

5. Open:

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
