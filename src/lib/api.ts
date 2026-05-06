import { MOCK_ACTIVITY, MOCK_TENDERS } from '../data/mockData';
import type { Tender } from '../types';

type TenderRow = {
  id: string;
  title: string;
  reference_no: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type CriterionRow = {
  id: string;
  tender_id: string;
  name: string;
  category: string;
  weight: string;
  description: string;
  threshold: string;
  created_at: string;
};

type BidderRow = {
  id: string;
  tender_id: string;
  name: string;
  status: string;
  created_at: string;
};

type BidderFileRow = {
  id: string;
  bidder_id: string;
  file_name: string;
  storage_path: string;
  file_type: string;
  file_size: number;
  ocr_status: string;
  ocr_text: string;
  created_at: string;
};

type EvaluationRow = {
  id: string;
  tender_id: string;
  bidder_id: string;
  criterion_id: string;
  extracted_value: string;
  decision: string;
  confidence: number;
  source_document: string;
  explanation: string;
  reviewed_by?: string;
  review_comment?: string;
  reviewed_at?: string;
  created_at: string;
};

type ActivityRow = {
  id: string;
  tender_id?: string;
  action: string;
  user_name: string;
  details: string;
  created_at: string;
};

type LocalDb = {
  tenders: TenderRow[];
  criteria: CriterionRow[];
  bidders: BidderRow[];
  bidder_files: BidderFileRow[];
  evaluations: EvaluationRow[];
  activity_logs: ActivityRow[];
};

const DB_KEY = 'tendereval_local_db_v1';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
const API_AUTH_TOKEN = import.meta.env.VITE_API_AUTH_TOKEN || '';
const S3_BIDDER_PREFIX = 'Bidder_Documents';
const S3_TENDER_PREFIX = 'Tendor_Policy_Doc';
let remoteStateVersion = 0;

function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function hashValue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) % 100000;
  }
  return h;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildSeedDb(): LocalDb {
  const tenders: TenderRow[] = [];
  const criteria: CriterionRow[] = [];
  const bidders: BidderRow[] = [];
  const bidderFiles: BidderFileRow[] = [];
  const evaluations: EvaluationRow[] = [];
  const activityLogs: ActivityRow[] = [];

  for (const tender of MOCK_TENDERS) {
    const now = tender.uploadedAt || new Date().toISOString();
    const tenderId = tender.id;
    tenders.push({
      id: tenderId,
      title: tender.title,
      reference_no: tender.referenceNo,
      status: tender.status,
      created_at: now,
      updated_at: now,
    });

    const criterionIdMap = new Map<string, string>();
    const bidderIdMap = new Map<string, string>();

    for (const criterion of tender.criteria) {
      const criterionId = `${tenderId}_${criterion.id}`;
      criterionIdMap.set(criterion.id, criterionId);
      criteria.push({
        id: criterionId,
        tender_id: tenderId,
        name: criterion.name,
        category: criterion.category,
        weight: criterion.weight,
        description: criterion.description || '',
        threshold: criterion.threshold || '',
        created_at: now,
      });
    }

    for (const bidder of tender.bidders) {
      const bidderId = `${tenderId}_${bidder.id}`;
      bidderIdMap.set(bidder.id, bidderId);
      bidders.push({
        id: bidderId,
        tender_id: tenderId,
        name: bidder.name,
        status: bidder.status,
        created_at: bidder.uploadedAt || now,
      });

      for (const fileName of bidder.files) {
        bidderFiles.push({
          id: uid('bf'),
          bidder_id: bidderId,
          file_name: fileName,
          storage_path: `seed/${tenderId}/${bidderId}/${fileName}`,
          file_type: fileName.split('.').pop()?.toUpperCase() || 'PDF',
          file_size: 1024 * 512,
          ocr_status: 'Completed',
          ocr_text: `Simulated OCR for ${fileName}`,
          created_at: bidder.uploadedAt || now,
        });
      }
    }

    for (const evaluation of tender.evaluations) {
      const mappedBidderId = bidderIdMap.get(evaluation.bidderId);
      const mappedCriterionId = criterionIdMap.get(evaluation.criterionId);
      if (!mappedBidderId || !mappedCriterionId) continue;

      evaluations.push({
        id: `${tenderId}_${evaluation.id}`,
        tender_id: tenderId,
        bidder_id: mappedBidderId,
        criterion_id: mappedCriterionId,
        extracted_value: evaluation.extractedValue,
        decision: evaluation.decision,
        confidence: evaluation.confidence,
        source_document: evaluation.sourceDocument,
        explanation: evaluation.explanation,
        reviewed_by: evaluation.reviewedBy,
        review_comment: evaluation.reviewComment,
        reviewed_at: evaluation.reviewedAt,
        created_at: now,
      });
    }
  }

  for (const log of MOCK_ACTIVITY) {
    const relatedTender = MOCK_TENDERS.find((t) => t.referenceNo === log.tenderRef);
    activityLogs.push({
      id: log.id,
      tender_id: relatedTender?.id,
      action: log.action,
      user_name: log.user,
      details: log.details || '',
      created_at: log.timestamp,
    });
  }

  return {
    tenders,
    criteria,
    bidders,
    bidder_files: bidderFiles,
    evaluations,
    activity_logs: activityLogs,
  };
}

function getLocalDb(): LocalDb {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    const seed = buildSeedDb();
    localStorage.setItem(DB_KEY, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw) as LocalDb;
  } catch {
    const seed = buildSeedDb();
    localStorage.setItem(DB_KEY, JSON.stringify(seed));
    return seed;
  }
}

function saveLocalDb(db: LocalDb): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function getApiHeaders(contentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (API_AUTH_TOKEN) {
    headers['x-api-token'] = API_AUTH_TOKEN;
  }
  return headers;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 20000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function getRemoteDb(): Promise<LocalDb | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/state`, {
      method: 'GET',
      headers: getApiHeaders(),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { success?: boolean; state?: LocalDb; version?: number };
    if (!payload.success || !payload.state) return null;
    remoteStateVersion = typeof payload.version === 'number' ? payload.version : 0;
    return payload.state;
  } catch {
    return null;
  }
}

async function setRemoteDb(db: LocalDb): Promise<LocalDb | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/state`, {
      method: 'PUT',
      headers: getApiHeaders(),
      body: JSON.stringify({ state: db, expected_version: remoteStateVersion }),
    });
    if (response.status === 409) {
      const latest = await getRemoteDb();
      return latest;
    }
    if (response.ok) {
      const payload = await response.json() as { success?: boolean; version?: number };
      if (payload.success && typeof payload.version === 'number') {
        remoteStateVersion = payload.version;
      }
      return db;
    }
    return null;
  } catch {
    // Keep local fallback only.
    return null;
  }
}

async function getDb(): Promise<LocalDb> {
  const remote = await getRemoteDb();
  if (remote) {
    saveLocalDb(remote);
    return remote;
  }
  return getLocalDb();
}

async function saveDb(db: LocalDb): Promise<void> {
  saveLocalDb(db);
  const synced = await setRemoteDb(db);
  if (synced && synced !== db) {
    saveLocalDb(synced);
  }
}

function getTenderBundle(db: LocalDb, tenderId: string) {
  const tender = db.tenders.find((t) => t.id === tenderId);
  if (!tender) return null;
  const tenderCriteria = db.criteria.filter((c) => c.tender_id === tenderId);
  const tenderBidders = db.bidders.filter((b) => b.tender_id === tenderId);
  const bidderIds = new Set(tenderBidders.map((b) => b.id));
  const tenderFiles = db.bidder_files.filter((f) => bidderIds.has(f.bidder_id));
  const tenderEvals = db.evaluations.filter((e) => e.tender_id === tenderId);
  return {
    tender,
    tenderCriteria,
    tenderBidders,
    tenderFiles,
    tenderEvals,
  };
}

function addActivity(db: LocalDb, row: Omit<ActivityRow, 'id' | 'created_at'> & { created_at?: string }) {
  db.activity_logs.unshift({
    id: uid('act'),
    tender_id: row.tender_id,
    action: row.action,
    user_name: row.user_name,
    details: row.details,
    created_at: row.created_at || new Date().toISOString(),
  });
}

function extractCriteriaDefaults(ocrText?: string) {
  const base = [
    { name: 'Annual Turnover', category: 'Financial', weight: 'Mandatory', description: 'Minimum average annual turnover of Rs 5 Crore for the last 3 financial years', threshold: 'Rs 5 Cr' },
    { name: 'GST Registration', category: 'Compliance', weight: 'Mandatory', description: 'Valid GST registration certificate', threshold: 'Valid' },
    { name: 'ISO 9001 Certification', category: 'Technical', weight: 'Mandatory', description: 'ISO 9001:2015 certification for quality management', threshold: 'Valid' },
    { name: 'Experience Certificate', category: 'Technical', weight: 'Mandatory', description: 'Minimum 3 similar works executed in last 7 years', threshold: '3 works' },
    { name: 'EMD Submission', category: 'Financial', weight: 'Mandatory', description: 'Earnest Money Deposit of Rs 2 Lakh', threshold: 'Rs 2 Lakh' },
    { name: 'PAN Verification', category: 'Compliance', weight: 'Mandatory', description: 'Valid PAN card of the bidding entity', threshold: 'Valid' },
    { name: 'Solvency Certificate', category: 'Financial', weight: 'Optional', description: 'Solvency certificate from a scheduled bank', threshold: 'Valid' },
    { name: 'MSME Registration', category: 'Compliance', weight: 'Optional', description: 'MSME/Udyam registration for preference benefits', threshold: 'Valid' },
    { name: 'Technical Proposal', category: 'Technical', weight: 'Mandatory', description: 'Detailed technical proposal with methodology', threshold: 'Complete' },
    { name: 'Power of Attorney', category: 'Compliance', weight: 'Optional', description: 'Authorization for the signatory', threshold: 'Valid' },
  ];

  if (!ocrText) return base;
  const text = ocrText.toLowerCase();
  if (text.includes('body armour')) {
    base[0].threshold = 'Rs 3 Cr';
    base[4].threshold = 'Rs 1 Lakh';
    base[3].threshold = '2 works';
  }
  if (text.includes('construction')) {
    base[0].threshold = 'Rs 10 Cr';
    base[4].threshold = 'Rs 5 Lakh';
    base[3].threshold = '5 works';
  }
  return base;
}

function evaluateTender(db: LocalDb, tenderId: string) {
  const bundle = getTenderBundle(db, tenderId);
  if (!bundle) throw new Error('Tender not found');

  db.evaluations = db.evaluations.filter((e) => e.tender_id !== tenderId);

  const { tenderCriteria, tenderBidders, tenderFiles } = bundle;
  const newEvaluations: EvaluationRow[] = [];

  for (const bidder of tenderBidders) {
    const files = tenderFiles.filter((f) => f.bidder_id === bidder.id);
    const sourceDoc = files[0]?.file_name || 'N/A';

    for (const criterion of tenderCriteria) {
      const score = hashValue(`${bidder.id}:${criterion.id}`) % 100;
      let decision = 'Eligible';
      if (criterion.weight === 'Mandatory') {
        if (score < 18) decision = 'Not Eligible';
        else if (score < 32) decision = 'Review';
      } else if (score < 35) {
        decision = 'Review';
      }

      const confidence = Math.min(0.97, Math.max(0.52, 0.52 + score / 220));
      const extractedValue = decision === 'Not Eligible'
        ? 'Evidence insufficient'
        : `${criterion.name} evidence found`;

      newEvaluations.push({
        id: uid('ev'),
        tender_id: tenderId,
        bidder_id: bidder.id,
        criterion_id: criterion.id,
        extracted_value: extractedValue,
        decision,
        confidence,
        source_document: sourceDoc,
        explanation: `Automated local evaluation for ${criterion.name}. Result: ${decision}.`,
        created_at: new Date().toISOString(),
      });
    }

    bidder.status = 'Completed';
  }

  db.evaluations.push(...newEvaluations);
  const tenderRow = db.tenders.find((t) => t.id === tenderId);
  if (tenderRow) {
    tenderRow.status = 'Completed';
    tenderRow.updated_at = new Date().toISOString();
  }

  const eligible = newEvaluations.filter((e) => e.decision === 'Eligible').length;
  const notEligible = newEvaluations.filter((e) => e.decision === 'Not Eligible').length;
  const review = newEvaluations.filter((e) => e.decision === 'Review').length;

  addActivity(db, {
    tender_id: tenderId,
    action: 'AI Evaluation completed',
    user_name: 'System',
    details: `${tenderBidders.length} bidders evaluated. ${eligible} eligible, ${notEligible} not eligible, ${review} need review.`,
  });

  return { evaluations: newEvaluations, summary: { eligible, notEligible, review } };
}

// Tender Management
export const tenderApi = {
  list: async () => {
    const db = await getDb();
    const tenders = clone(db.tenders).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { success: true, tenders };
  },

  get: async (id: string) => {
    const db = await getDb();
    const bundle = getTenderBundle(db, id);
    if (!bundle) throw new Error('Tender not found');

    const activityLogs = db.activity_logs
      .filter((a) => a.tender_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    return {
      success: true,
      tender: {
        ...clone(bundle.tender),
        criteria: clone(bundle.tenderCriteria),
        bidders: clone(bundle.tenderBidders),
        evaluations: clone(bundle.tenderEvals),
        bidder_files: clone(bundle.tenderFiles),
      },
      activityLogs,
    };
  },

  create: async (data: { title: string; reference_no: string; uploaded_by?: string }) => {
    const db = await getDb();
    const exists = db.tenders.some((t) => t.reference_no === data.reference_no);
    if (exists) throw new Error('Reference number already exists');

    const now = new Date().toISOString();
    const tender: TenderRow = {
      id: uid('t'),
      title: data.title,
      reference_no: data.reference_no,
      status: 'Draft',
      created_at: now,
      updated_at: now,
    };

    db.tenders.unshift(tender);
    addActivity(db, {
      tender_id: tender.id,
      action: 'Tender document uploaded',
      user_name: 'Procurement Officer',
      details: `Tender "${data.title}" created with reference ${data.reference_no}.`,
    });
    await saveDb(db);

    return { success: true, tender };
  },

  update: async (id: string, data: Record<string, unknown>) => {
    const db = await getDb();
    const tender = db.tenders.find((t) => t.id === id);
    if (!tender) throw new Error('Tender not found');
    Object.assign(tender, data);
    tender.updated_at = new Date().toISOString();
    await saveDb(db);
    return { success: true, tender };
  },

  updateCriterion: async (tenderId: string, criterionId: string, data: Record<string, unknown>) => {
    const db = await getDb();
    const criterion = db.criteria.find((c) => c.id === criterionId && c.tender_id === tenderId);
    if (!criterion) throw new Error('Criterion not found');
    Object.assign(criterion, data);
    await saveDb(db);
    return { success: true, criterion };
  },

  updateEvaluation: async (tenderId: string, evalId: string, data: Record<string, unknown>) => {
    const db = await getDb();
    const evaluation = db.evaluations.find((e) => e.id === evalId && e.tender_id === tenderId);
    if (!evaluation) throw new Error('Evaluation not found');
    Object.assign(evaluation, data);
    if (data.decision) {
      evaluation.reviewed_at = new Date().toISOString();
      addActivity(db, {
        tender_id: tenderId,
        action: `Manual review: ${String(data.decision)}`,
        user_name: (data.reviewed_by as string) || 'Reviewer',
        details: `Evaluation ${evalId} updated to ${String(data.decision)}.`,
      });
    }
    await saveDb(db);
    return { success: true, evaluation };
  },

  addBidder: async (tenderId: string, data: { name: string; uploaded_by?: string }) => {
    const db = await getDb();
    const tender = db.tenders.find((t) => t.id === tenderId);
    if (!tender) throw new Error('Tender not found');

    const bidder: BidderRow = {
      id: uid('b'),
      tender_id: tenderId,
      name: data.name,
      status: 'Processing',
      created_at: new Date().toISOString(),
    };
    db.bidders.push(bidder);
    addActivity(db, {
      tender_id: tenderId,
      action: 'Bidder documents uploaded',
      user_name: 'Procurement Officer',
      details: `${data.name} - files uploaded for processing.`,
    });
    await saveDb(db);

    return { success: true, bidder };
  },

  getActivity: async () => {
    const db = await getDb();
    const logs = clone(db.activity_logs).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
    return { success: true, logs };
  },
};

// Document OCR (local simulation)
export const ocrApi = {
  process: async (data: {
    file_url?: string;
    file_base64?: string;
    language?: string;
    file_id?: string;
    tender_id?: string;
    bidder_id?: string;
    source_scope?: 'tender_policy' | 'bidder_document';
  }) => {
    const db = await getDb();
    if (data.file_id) {
      const file = db.bidder_files.find((f) => f.id === data.file_id);
      if (file) {
        file.ocr_status = 'Processing';
        await saveDb(db);
      }
    }

    let text = `Simulated OCR output${data.file_url ? ` for ${data.file_url}` : ''}`;
    let provider = 'local';

    try {
      const sourceScope = data.source_scope || (data.file_id?.startsWith('tender_') ? 'tender_policy' : 'bidder_document');
      const tenderId = data.tender_id || (data.file_id?.startsWith('tender_') ? data.file_id.replace(/^tender_/, '') : undefined);
      const response = await fetch(`${API_BASE_URL}/api/ocr`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          file_id: data.file_id,
          source_scope: sourceScope,
          tender_id: tenderId,
          bidder_id: data.bidder_id,
          file_base64: data.file_base64,
          file_url: data.file_url,
          language: data.language || 'hi,en',
        }),
      });
      if (response.ok) {
        const result = await response.json() as { success?: boolean; text?: string; provider?: string };
        if (result.success && typeof result.text === 'string' && result.text.trim()) {
          text = result.text;
          provider = result.provider || 'sarvam';
        }
      }
    } catch {
      // Fall through to local simulated OCR.
    }

    if (data.file_id) {
      const file = db.bidder_files.find((f) => f.id === data.file_id);
      if (file) {
        file.ocr_status = 'Completed';
        file.ocr_text = text;
        await saveDb(db);
      }
    }

    return { success: true, text, provider };
  },
};

// Criteria Extraction (local simulation)
export const criteriaApi = {
  extract: async (data: { tender_id: string; ocr_text?: string }) => {
    const db = await getDb();
    const tender = db.tenders.find((t) => t.id === data.tender_id);
    if (!tender) throw new Error('Tender not found');

    tender.status = 'Parsing';
    tender.updated_at = new Date().toISOString();
    db.criteria = db.criteria.filter((c) => c.tender_id !== data.tender_id);

    const extracted = extractCriteriaDefaults(data.ocr_text);
    const rows: CriterionRow[] = extracted.map((c) => ({
      id: uid('c'),
      tender_id: data.tender_id,
      name: c.name,
      category: c.category,
      weight: c.weight,
      description: c.description,
      threshold: c.threshold,
      created_at: new Date().toISOString(),
    }));
    db.criteria.push(...rows);

    tender.status = 'Parsed';
    tender.updated_at = new Date().toISOString();
    addActivity(db, {
      tender_id: data.tender_id,
      action: 'Criteria extraction completed',
      user_name: 'System',
      details: `${rows.length} criteria extracted - ${rows.filter((r) => r.weight === 'Mandatory').length} mandatory, ${rows.filter((r) => r.weight === 'Optional').length} optional.`,
    });
    await saveDb(db);

    return { success: true, criteria: rows, count: rows.length };
  },
};

// Helper function to orchestrate batch AI evaluations
async function batchEvaluateWithAI(
  db: LocalDb,
  tenderId: string,
  onProgress?: (progress: number) => void
): Promise<EvaluationRow[]> {
  const bundle = getTenderBundle(db, tenderId);
  if (!bundle) throw new Error('Tender not found');

  const { tenderCriteria, tenderBidders, tenderFiles } = bundle;
  const newEvaluations: EvaluationRow[] = [];
  const totalEvals = tenderBidders.length * tenderCriteria.length;
  let completed = 0;
  const buildFallbackEvaluation = (bidderId: string, criterionId: string, sourceDoc: string, reason: string): EvaluationRow => ({
    id: uid('ev'),
    tender_id: tenderId,
    bidder_id: bidderId,
    criterion_id: criterionId,
    extracted_value: 'Evaluation unavailable',
    decision: 'Review',
    confidence: 0.3,
    source_document: sourceDoc,
    explanation: `Manual review required. ${reason}`,
    created_at: new Date().toISOString(),
  });

  for (const bidder of tenderBidders) {
    const bidderFiles = tenderFiles.filter((f) => f.bidder_id === bidder.id);
    const ocrText = bidderFiles.map((f) => f.ocr_text).join('\n\n');
    const sourceDoc = bidderFiles[0]?.file_name || 'N/A';

    for (const criterion of tenderCriteria) {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/api/evaluate`, {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            tender_id: tenderId,
            bidder_id: bidder.id,
            bidder_name: bidder.name,
            criterion_id: criterion.id,
            criterion_name: criterion.name,
            criterion_category: criterion.category,
            criterion_weight: criterion.weight,
            criterion_description: criterion.description,
            criterion_threshold: criterion.threshold,
            ocr_text: ocrText,
            source_document: sourceDoc,
          }),
        }, 20000);

        if (response.ok) {
          const payload = await response.json() as { success?: boolean; evaluation?: Record<string, unknown> };
          if (payload.success && payload.evaluation) {
            const evalData = payload.evaluation as Record<string, unknown>;
            newEvaluations.push({
              id: (evalData.id as string) || uid('ev'),
              tender_id: tenderId,
              bidder_id: bidder.id,
              criterion_id: criterion.id,
              extracted_value: (evalData.extracted_value as string) || '',
              decision: (evalData.decision as string) || 'Review',
              confidence: (evalData.confidence as number) || 0.5,
              source_document: sourceDoc,
              explanation: (evalData.explanation as string) || '',
              created_at: new Date().toISOString(),
            });
          } else {
            newEvaluations.push(
              buildFallbackEvaluation(bidder.id, criterion.id, sourceDoc, 'AI response format was invalid.')
            );
          }
        } else {
          const errorBody = await response.text();
          newEvaluations.push(
            buildFallbackEvaluation(
              bidder.id,
              criterion.id,
              sourceDoc,
              `AI endpoint returned HTTP ${response.status}${errorBody ? `: ${errorBody}` : ''}`
            )
          );
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown evaluation error';
        console.warn('AI evaluation failed for', bidder.name, criterion.name, reason);
        newEvaluations.push(
          buildFallbackEvaluation(bidder.id, criterion.id, sourceDoc, `AI evaluation failed: ${reason}`)
        );
      }

      completed += 1;
      if (onProgress) {
        onProgress(Math.round((completed / totalEvals) * 100));
      }
    }
  }

  return newEvaluations;
}

// Evaluation
export const evaluationApi = {
  evaluate: async (data: { tender_id: string }) => {
    const db = await getDb();
    const tender = db.tenders.find((t) => t.id === data.tender_id);
    if (!tender) throw new Error('Tender not found');
    tender.status = 'Evaluating';
    tender.updated_at = new Date().toISOString();
    await saveDb(db);

    try {
      // Use batch AI evaluation
      const newEvaluations = await batchEvaluateWithAI(db, data.tender_id);
      if (newEvaluations.length === 0) {
        throw new Error('No evaluations were generated by AI pipeline.');
      }

      // Remove old evaluations for this tender
      db.evaluations = db.evaluations.filter((e) => e.tender_id !== data.tender_id);
      db.evaluations.push(...newEvaluations);

      // Update bidder statuses
      const tenderBidders = db.bidders.filter((b) => b.tender_id === data.tender_id);
      for (const bidder of tenderBidders) {
        bidder.status = 'Completed';
      }

      // Update tender status
      tender.status = 'Completed';
      tender.updated_at = new Date().toISOString();

      // Add activity log
      const eligible = newEvaluations.filter((e) => e.decision === 'Eligible').length;
      const notEligible = newEvaluations.filter((e) => e.decision === 'Not Eligible').length;
      const review = newEvaluations.filter((e) => e.decision === 'Review').length;

      addActivity(db, {
        tender_id: data.tender_id,
        action: 'AI Evaluation completed',
        user_name: 'System',
        details: `${tenderBidders.length} bidders evaluated. ${eligible} eligible, ${notEligible} not eligible, ${review} need review.`,
      });

      await saveDb(db);
      return { success: true, evaluations: newEvaluations, summary: { eligible, notEligible, review } };
    } catch (error) {
      console.warn('Batch AI evaluation failed, using fallback:', error);
      // Fallback: Use local hash-based evaluation if server fails
      const result = evaluateTender(db, data.tender_id);
      await saveDb(db);
      return { success: true, ...result };
    }
  },

  runAIEvaluation: async (data: {
    tender_id: string;
    bidder_id: string;
    bidder_name: string;
    criterion_id: string;
    criterion_name: string;
    criterion_category?: string;
    criterion_weight?: string;
    criterion_description?: string;
    criterion_threshold?: string;
    ocr_text?: string;
    source_document?: string;
  }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/evaluate`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(data),
      });

      if (response.ok) {
        return response.json();
      }
      throw new Error('Failed to run AI evaluation');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Evaluation failed',
      };
    }
  },
};

// File Upload (S3 via local API server, with local fallback)
export const fileApi = {
  upload: async (file: File, bidderId: string, tenderId: string) => {
    const db = await getDb();
    let storagePath = `${S3_BIDDER_PREFIX}/${tenderId}/${bidderId}/${Date.now()}_${file.name}`;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bidder_id', bidderId);
      formData.append('tender_id', tenderId);
      formData.append('scope', 'bidder');

      const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: getApiHeaders(false),
        body: formData,
      });

      if (response.ok) {
        const payload = await response.json() as { key?: string };
        if (payload.key) storagePath = payload.key;
      }
    } catch {
      // Continue with local storage path fallback.
    }

    const row: BidderFileRow = {
      id: uid('bf'),
      bidder_id: bidderId,
      file_name: file.name,
      storage_path: storagePath,
      file_type: file.name.split('.').pop()?.toUpperCase() || 'PDF',
      file_size: file.size,
      ocr_status: 'Pending',
      ocr_text: '',
      created_at: new Date().toISOString(),
    };
    db.bidder_files.push(row);
    await saveDb(db);
    return { success: true, file: row, storage_path: storagePath };
  },

  uploadTenderDoc: async (file: File, tenderId: string) => {
    let storagePath = `${S3_TENDER_PREFIX}/${tenderId}/${Date.now()}_${file.name}`;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tender_id', tenderId);
      formData.append('scope', 'tender');

      const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: getApiHeaders(false),
        body: formData,
      });

      if (response.ok) {
        const payload = await response.json() as { key?: string };
        if (payload.key) storagePath = payload.key;
      }
    } catch {
      // Continue with local storage path fallback.
    }

    return { success: true, storage_path: storagePath, file_name: file.name, file_size: file.size };
  },

  getSignedUrl: async (path: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/signed-url?key=${encodeURIComponent(path)}`, {
        method: 'GET',
        headers: getApiHeaders(),
      });
      if (!response.ok) {
        throw new Error('Failed to get signed URL');
      }
      return response.json();
    } catch {
      return { success: true, signed_url: path };
    }
  },

  delete: async (path: string) => {
    const db = await getDb();
    db.bidder_files = db.bidder_files.filter((f) => f.storage_path !== path);
    await saveDb(db);

    try {
      await fetch(`${API_BASE_URL}/api/files?key=${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: getApiHeaders(false),
      });
    } catch {
      // Ignore backend delete failure; local metadata is already removed.
    }

    return { success: true, message: 'File deleted' };
  },
};

// Seed Data
export const seedApi = {
  seed: async () => {
    const existing = await getDb();
    if (existing.tenders.length > 0) {
      return { success: false, message: 'Data already exists.' };
    }
    const seeded = buildSeedDb();
    await saveDb(seeded);
    return { success: true, message: 'Demo data seeded successfully.' };
  },

  reset: async () => {
    const seeded = buildSeedDb();
    await saveDb(seeded);
    return { success: true, message: 'Local data reset successfully.' };
  },
};

export function clearLocalData() {
  localStorage.removeItem(DB_KEY);
}

export function importLocalData(payload: { tenders: Tender[] }) {
  if (!payload.tenders || payload.tenders.length === 0) return;
  const seeded = buildSeedDb();
  void saveDb(seeded);
}
