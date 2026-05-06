# TenderEval - AI-Powered Tender Evaluation System

TenderEval is a React + TypeScript application for evaluating bidder eligibility against tender criteria with explainable AI-style decisions.

## Current Backend Mode

Supabase has been removed completely.

The app now uses:
- Frontend: React app (`src/lib/api.ts`)
- Backend API: local Node server (`server/index.js`)
- Persistence: MongoDB for app state/OCR records + AWS S3 for uploaded files
- Fallback: local browser storage if API server is unreachable
- OCR: Sarvam OCR from server-side key, otherwise simulated locally

## Features

- Tender creation and tender document upload flow
- Criteria extraction simulation
- Bidder upload workflow
- Evaluation execution and review flags
- Manual review and decision override
- Dashboard, summary charts, and detailed reports

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- Recharts
- React Router

## Getting Started

### Prerequisites

- Node.js 18+

### Install

```bash
npm install
```

### Run

```bash
npm run dev:api
```

In a second terminal:

```bash
npm run dev
```

Open `http://localhost:5173`.

### Environment

Create a local `.env` file with:

```env
VITE_API_BASE_URL=http://localhost:8787
VITE_API_AUTH_TOKEN=CHANGE_ME_LONG_RANDOM_TOKEN

SARVAM_API_URL=https://api.sarvam.ai/v1/ocr
SARVAM_API_KEY=YOUR_SARVAM_API_KEY

SARVAM_LLM_API_URL=https://api.sarvam.ai/v1/chat/completions
SARVAM_LLM_API_KEY=YOUR_SARVAM_LLM_API_KEY

OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
S3_BUCKET_NAME=YOUR_S3_BUCKET_NAME
S3_BIDDER_PREFIX=Bidder_Documents
S3_TENDER_PREFIX=Tendor_Policy_Doc
API_AUTH_TOKEN=CHANGE_ME_LONG_RANDOM_TOKEN
MAX_UPLOAD_MB=50

MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=tendereval
MONGODB_STATE_COLLECTION=app_state
MONGODB_STATE_DOC_ID=current
MONGODB_OCR_COLLECTION=ocr_results
MONGODB_EVALUATIONS_COLLECTION=evaluations
```

Optional for S3-compatible services:

```env
S3_ENDPOINT=http://127.0.0.1:9000
S3_FORCE_PATH_STYLE=true
```

## Data Notes

- Initial dataset is seeded from `src/data/mockData.ts`
- Runtime app state is persisted in MongoDB (`MONGODB_STATE_COLLECTION`)
- OCR outputs are persisted in MongoDB (`MONGODB_OCR_COLLECTION`)
- State writes use optimistic versioning (`expected_version`) to reduce overwrite races
- Uploaded files are stored in S3 bucket paths by tender/bidder
- OCR key is server-only (never exposed to browser)
- If backend is down, app falls back to local browser data

## Project Structure

```text
src/
  components/
    common/
    layout/
  data/
  lib/
    api.ts        # Local simulated API (no Supabase)
    mappers.ts
  pages/
  store/
  types/
server/
  index.js      # API server (MongoDB state/OCR + S3 file storage)
```

## License

Internal use - CRPF Procurement Division
