# TenderEval — AI-Powered Tender Evaluation System

An intelligent procurement evaluation platform for CRPF (Central Reserve Police Force) that automates the assessment of bidder eligibility criteria using AI-driven document analysis, OCR, and explainable decision-making.

## Overview

TenderEval streamlines the government tender evaluation process by:

- Extracting eligibility criteria from tender documents via OCR
- Processing bidder submission documents automatically
- Running AI evaluation against each criterion with confidence scores
- Flagging items that need manual review
- Providing a full audit trail for transparency and compliance

## Architecture

```
Frontend (React + TypeScript + Vite)
  |
  |-- Zustand (state management)
  |-- Recharts (data visualization)
  |-- Tailwind CSS (styling)
  |-- Lucide React (icons)
  |
Backend (Supabase)
  |-- PostgreSQL (6 tables with RLS)
  |-- Edge Functions (6 serverless functions)
  |-- Storage (tender-documents bucket)
```

## Database Schema

| Table | Purpose |
|---|---|
| `tenders` | Tender metadata and lifecycle status |
| `criteria` | Eligibility criteria extracted from tender docs |
| `bidders` | Bidder companies submitting proposals |
| `bidder_files` | Individual documents per bidder |
| `evaluations` | AI decisions per bidder per criterion |
| `activity_logs` | Full audit trail |

All tables have Row Level Security (RLS) enabled with policies restricting access to authenticated users and tender owners.

## Edge Functions

| Function | Purpose |
|---|---|
| `tender-management` | CRUD for tenders, criteria, bidders, evaluations |
| `document-ocr` | OCR processing via Sarvam AI API |
| `criteria-extract` | AI-powered criteria extraction from tender text |
| `evaluate-bidders` | AI evaluation of bidder docs against criteria |
| `file-upload` | File upload to Supabase Storage |
| `seed-data` | Populate demo data for testing |

## Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Overview stats, recent activity, active tenders |
| Tender Upload | `/tender-upload` | Create tenders, upload docs, review extracted criteria |
| Bidder Submissions | `/bidder-upload` | Upload bidder documents, trigger evaluation |
| AI Evaluation | `/evaluation` | Detailed evaluation results with explainable AI |
| Decision Summary | `/decision-summary` | Charts and filters for evaluation decisions |
| Detailed Report | `/report` | Full audit trail with bidder summary table |
| Manual Review | `/review` | Resolve items flagged for human verification |

## Workflow

```
1. Create Tender  -->  2. Upload Tender Doc  -->  3. AI Extracts Criteria
                                                          |
4. Generate Report  <--  5. Manual Review  <--  4. AI Evaluates Bidders
                                                          |
                                                   3. Upload Bidder Docs
```

1. **Create a tender** with title and reference number
2. **Upload the tender document** — AI extracts eligibility criteria (mandatory/optional, thresholds)
3. **Upload bidder documents** — files are stored and OCR-processed
4. **Run AI evaluation** — each bidder is evaluated against each criterion with confidence scores
5. **Review flagged items** — human reviewers resolve low-confidence or ambiguous decisions
6. **Generate report** — full audit trail with bidder summary and decision breakdown

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project (already provisioned)

### Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Sarvam AI (optional — OCR falls back to simulation without it)
VITE_SARVAM_API_URL=https://api.sarvam.ai
SARVAM_API_KEY=your_sarvam_api_key

# Application
VITE_APP_NAME=TenderEval
VITE_APP_ENV=development
```

### Installation

```bash
npm install
npm run dev
```

### Seed Demo Data

Click the **Seed Demo** button on the Dashboard, or call the edge function directly:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/seed-data \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

This populates the database with 3 tenders, 20 criteria, 8 bidders, 50 evaluations, and 8 activity logs.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Zustand, Recharts, Lucide React
- **Backend**: Supabase (PostgreSQL, Edge Functions, Storage, RLS)
- **AI/OCR**: Sarvam AI API (optional — simulated when unavailable)
- **Routing**: React Router v7

## Project Structure

```
src/
  components/
    common/          # Reusable UI (StatusBadge, ConfidenceIndicator, etc.)
    layout/          # AppLayout, Header, Sidebar
  data/              # Mock data for fallback
  lib/               # API client, Supabase client, data mappers
  pages/             # Route page components
  store/             # Zustand store
  types/             # TypeScript interfaces
supabase/
  functions/         # Edge functions
  migrations/        # Database migrations
```

## License

Internal use — CRPF Procurement Division
