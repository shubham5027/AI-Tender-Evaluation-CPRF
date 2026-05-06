import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { z } from 'zod';
import { MongoClient } from 'mongodb';
import {
  S3Client,
  HeadBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const app = express();

const PORT = Number(process.env.API_PORT || 8787);
const BUCKET = process.env.S3_BUCKET_NAME;
const SARVAM_API_URL = process.env.SARVAM_API_URL || 'https://api.sarvam.ai/v1/ocr';
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';
const SARVAM_LLM_API_URL = process.env.SARVAM_LLM_API_URL || 'https://api.sarvam.ai/v1/chat/completions';
const SARVAM_USE_OCR_KEY_FOR_LLM = process.env.SARVAM_USE_OCR_KEY_FOR_LLM === 'true';
const SARVAM_LLM_API_KEY = process.env.SARVAM_LLM_API_KEY || (SARVAM_USE_OCR_KEY_FOR_LLM ? SARVAM_API_KEY : '');
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const S3_BIDDER_PREFIX = process.env.S3_BIDDER_PREFIX || 'Bidder_Documents';
const S3_TENDER_PREFIX = process.env.S3_TENDER_PREFIX || 'Tendor_Policy_Doc';
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || '';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 50);
const EXTERNAL_AI_TIMEOUT_MS = Number(process.env.EXTERNAL_AI_TIMEOUT_MS || 8000);
const MAX_OCR_CHARS_FOR_EVAL = Number(process.env.MAX_OCR_CHARS_FOR_EVAL || 12000);
const MONGODB_SERVER_SELECTION_TIMEOUT_MS = Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000);
const MONGODB_CONNECT_TIMEOUT_MS = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 5000);
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'tendereval';
const MONGODB_STATE_COLLECTION = process.env.MONGODB_STATE_COLLECTION || 'app_state';
const MONGODB_OCR_COLLECTION = process.env.MONGODB_OCR_COLLECTION || 'ocr_results';
const MONGODB_TENDER_OCR_COLLECTION = process.env.MONGODB_TENDER_OCR_COLLECTION || 'tender_policy_ocr';
const MONGODB_BIDDER_OCR_COLLECTION = process.env.MONGODB_BIDDER_OCR_COLLECTION || 'bidder_document_ocr';
const MONGODB_EVALUATIONS_COLLECTION = process.env.MONGODB_EVALUATIONS_COLLECTION || 'evaluations';
const MONGODB_EVALUATION_TRACES_COLLECTION = process.env.MONGODB_EVALUATION_TRACES_COLLECTION || 'evaluation_traces';
const MONGODB_UPLOAD_EVENTS_COLLECTION = process.env.MONGODB_UPLOAD_EVENTS_COLLECTION || 'upload_events';
const STATE_DOC_ID = process.env.MONGODB_STATE_DOC_ID || 'current';

if (!BUCKET) {
  throw new Error('Missing S3_BUCKET_NAME in environment.');
}
if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI in environment.');
}

if (!API_AUTH_TOKEN) {
  console.warn('[security] API_AUTH_TOKEN is not set. API routes are currently open.');
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});

const mongoClient = new MongoClient(MONGODB_URI, {
  serverSelectionTimeoutMS: MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  connectTimeoutMS: MONGODB_CONNECT_TIMEOUT_MS,
});
let mongoConnectPromise = null;
let mongoWriteBackoffUntil = 0;
let lastMongoWriteError = '';

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const statePutSchema = z.object({
  expected_version: z.number().int().nonnegative(),
  state: z.record(z.any()),
});

const ocrSchema = z.object({
  file_base64: z.string().min(1).optional(),
  file_url: z.string().url().optional(),
  language: z.string().optional(),
  file_id: z.string().optional(),
  tender_id: z.string().optional(),
  bidder_id: z.string().optional(),
  source_scope: z.enum(['tender_policy', 'bidder_document']).optional(),
}).refine((v) => Boolean(v.file_base64 || v.file_url), {
  message: 'Either file_base64 or file_url is required.',
});

const evaluateSchema = z.object({
  tender_id: z.string().min(1),
  bidder_id: z.string().min(1),
  bidder_name: z.string().min(1),
  criterion_id: z.string().min(1),
  criterion_name: z.string().min(1),
  criterion_category: z.string().optional(),
  criterion_weight: z.string().optional(),
  criterion_description: z.string().optional(),
  criterion_threshold: z.string().optional(),
  ocr_text: z.string().optional(),
  source_document: z.string().optional(),
});

function getApiToken(req) {
  const headerToken = req.headers['x-api-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) return headerToken.trim();

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

function authMiddleware(req, res, next) {
  if (!API_AUTH_TOKEN) return next();
  const token = getApiToken(req);
  if (token !== API_AUTH_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  return next();
}

async function getMongoDb() {
  if (!mongoConnectPromise) {
    mongoConnectPromise = mongoClient.connect();
  }
  await mongoConnectPromise;
  return mongoClient.db(MONGODB_DB_NAME);
}

async function getStateCollection() {
  const db = await getMongoDb();
  return db.collection(MONGODB_STATE_COLLECTION);
}

async function getOcrCollection() {
  const db = await getMongoDb();
  return db.collection(MONGODB_OCR_COLLECTION);
}

async function getTenderOcrCollection() {
  const db = await getMongoDb();
  return db.collection(MONGODB_TENDER_OCR_COLLECTION);
}

async function getBidderOcrCollection() {
  const db = await getMongoDb();
  return db.collection(MONGODB_BIDDER_OCR_COLLECTION);
}

async function getEvaluationsCollection() {
  const db = await getMongoDb();
  return db.collection(MONGODB_EVALUATIONS_COLLECTION);
}

async function getEvaluationTracesCollection() {
  const db = await getMongoDb();
  return db.collection(MONGODB_EVALUATION_TRACES_COLLECTION);
}

async function getUploadEventsCollection() {
  const db = await getMongoDb();
  return db.collection(MONGODB_UPLOAD_EVENTS_COLLECTION);
}

function canAttemptMongoWrite() {
  return Date.now() >= mongoWriteBackoffUntil;
}

function noteMongoWriteFailure(message) {
  lastMongoWriteError = message;
  mongoWriteBackoffUntil = Date.now() + 60_000;
}

async function readStateEnvelope() {
  const collection = await getStateCollection();
  const doc = await collection.findOne({ _id: STATE_DOC_ID });
  if (!doc) return null;
  return {
    version: typeof doc.version === 'number' ? doc.version : 0,
    state: doc.state && typeof doc.state === 'object' ? doc.state : null,
  };
}

function extractSarvamText(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload;

  if (typeof data.text === 'string' && data.text.trim()) return data.text.trim();
  if (typeof data.output === 'string' && data.output.trim()) return data.output.trim();
  if (
    data.result &&
    typeof data.result === 'object' &&
    typeof data.result.text === 'string' &&
    data.result.text.trim()
  ) {
    return data.result.text.trim();
  }

  return '';
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = EXTERNAL_AI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    return { response, raw, parsed };
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeDecision(input, fallback = 'Review') {
  const value = String(input || '').trim().toLowerCase();
  if (value === 'eligible') return 'Eligible';
  if (value === 'not eligible' || value === 'not_eligible' || value === 'noteligible') return 'Not Eligible';
  if (value === 'review' || value === 'needs review' || value === 'needs_review') return 'Review';
  return fallback;
}

function normalizeConfidence(input, fallback = 0.5) {
  const value = Number(input);
  if (!Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function resolveDocumentScope(payload) {
  if (payload?.source_scope === 'tender_policy' || payload?.source_scope === 'bidder_document') {
    return payload.source_scope;
  }
  const fileId = String(payload?.file_id || '');
  if (fileId.startsWith('tender_') || fileId.startsWith('policy_')) return 'tender_policy';
  return 'bidder_document';
}

async function evaluateWithLLM(evaluationData) {
  const {
    criterion_name,
    criterion_description,
    criterion_threshold,
    criterion_weight,
    ocr_text,
    bidder_name,
  } = evaluationData;
  const compactOcrText = typeof ocr_text === 'string'
    ? ocr_text.slice(0, MAX_OCR_CHARS_FOR_EVAL)
    : '';

  const prompt = `You are an expert tender evaluation assistant. Evaluate the bidder against the criterion based on the OCR-extracted document text.

Bidder Name: ${bidder_name}
Criterion: ${criterion_name}
Weight: ${criterion_weight || 'Not specified'}
Category: ${evaluationData.criterion_category || 'General'}
Description: ${criterion_description || 'No description'}
Threshold: ${criterion_threshold || 'Not specified'}

Document Text:
${compactOcrText || 'No OCR text provided'}

Please evaluate and respond in this exact JSON format (no markdown, no code blocks):
{
  "decision": "Eligible|Not Eligible|Review",
  "confidence": 0.0-1.0,
  "extracted_value": "What was extracted from the document",
  "explanation": "Detailed explanation of the decision"
}`;

  // Try Sarvam LLM first
  if (SARVAM_LLM_API_KEY) {
    try {
      const { response, parsed } = await fetchJsonWithTimeout(SARVAM_LLM_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': SARVAM_LLM_API_KEY,
        },
        body: JSON.stringify({
          model: 'Meta-Llama-3-8B-Instruct',
          messages: [
            {
              role: 'system',
              content: 'You are an expert tender evaluation assistant. Respond only with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const result = parsed;
        if (result.choices && result.choices[0]?.message?.content) {
          const content = result.choices[0].message.content.trim();
          try {
            const parsed = JSON.parse(content);
            return {
              ...parsed,
              decision: normalizeDecision(parsed.decision),
              confidence: normalizeConfidence(parsed.confidence),
              provider: 'sarvam-llm',
            };
          } catch {
            // If JSON parsing fails, try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return {
                ...parsed,
                decision: normalizeDecision(parsed.decision),
                confidence: normalizeConfidence(parsed.confidence),
                provider: 'sarvam-llm',
              };
            }
          }
        }
      } else {
        console.warn(`Sarvam LLM responded ${response.status}`);
      }
    } catch (error) {
      console.warn('Sarvam LLM failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Fallback to OpenRouter
  if (OPENROUTER_API_KEY) {
    try {
      const { response, parsed } = await fetchJsonWithTimeout(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'http://localhost:8787',
          'X-Title': 'AI-Tender-Evaluation',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert tender evaluation assistant. Respond only with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const result = parsed;
        if (result.choices && result.choices[0]?.message?.content) {
          const content = result.choices[0].message.content.trim();
          try {
            const parsed = JSON.parse(content);
            return {
              ...parsed,
              decision: normalizeDecision(parsed.decision),
              confidence: normalizeConfidence(parsed.confidence),
              provider: 'openrouter',
            };
          } catch {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return {
                ...parsed,
                decision: normalizeDecision(parsed.decision),
                confidence: normalizeConfidence(parsed.confidence),
                provider: 'openrouter',
              };
            }
          }
        }
      } else {
        console.warn(`OpenRouter responded ${response.status}`);
      }
    } catch (error) {
      console.warn('OpenRouter failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Fallback: deterministic evaluation based on keywords
  const text = (ocr_text || '').toLowerCase();
  let decision = 'Review';
  let confidence = 0.5;
  let extracted_value = 'No clear evidence found';

  if (criterion_weight === 'Mandatory') {
    // For mandatory criteria, be strict
    const hasEvidence = text.length > 50 && (text.includes(criterion_name.toLowerCase()) || text.includes('certificate') || text.includes('valid'));
    decision = hasEvidence ? 'Eligible' : 'Not Eligible';
    confidence = hasEvidence ? 0.85 : 0.75;
    extracted_value = hasEvidence ? `${criterion_name} evidence found` : 'Evidence not found';
  } else {
    // For optional, more lenient
    decision = text.length > 20 ? 'Eligible' : 'Review';
    confidence = text.length > 20 ? 0.7 : 0.4;
    extracted_value = text.length > 20 ? `${criterion_name} information present` : 'Insufficient information';
  }

  return {
    decision: normalizeDecision(decision),
    confidence: normalizeConfidence(confidence),
    extracted_value,
    explanation: `Fallback evaluation: ${decision} with ${Math.round(confidence * 100)}% confidence.`,
    provider: 'fallback',
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, storage: 's3', database: 'mongodb' });
});

app.get('/health/deps', async (_req, res) => {
  const result = {
    ok: false,
    mongo: { ok: false, error: '' },
    s3: { ok: false, error: '' },
  };

  try {
    const db = await getMongoDb();
    await db.command({ ping: 1 });
    result.mongo.ok = true;
  } catch (error) {
    result.mongo.error = error instanceof Error ? error.message : 'MongoDB check failed';
  }

  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    result.s3.ok = true;
  } catch (error) {
    result.s3.error = error instanceof Error ? error.message : 'S3 check failed';
  }

  result.ok = result.mongo.ok && result.s3.ok;
  const statusCode = result.ok ? 200 : 503;
  return res.status(statusCode).json(result);
});

app.get('/health/ai', (_req, res) => {
  const now = Date.now();
  res.json({
    ok: true,
    llm: {
      sarvam_configured: Boolean(SARVAM_LLM_API_KEY),
      sarvam_using_ocr_key: SARVAM_USE_OCR_KEY_FOR_LLM,
      openrouter_configured: Boolean(OPENROUTER_API_KEY),
      timeout_ms: EXTERNAL_AI_TIMEOUT_MS,
    },
    mongo_write: {
      available: canAttemptMongoWrite(),
      backoff_ms_remaining: Math.max(0, mongoWriteBackoffUntil - now),
      last_error: lastMongoWriteError,
    },
  });
});

app.use('/api', authMiddleware);

app.get('/api/observability/summary', async (req, res) => {
  try {
    const tenderId = String(req.query.tender_id || '').trim();
    const filter = tenderId ? { tender_id: tenderId } : {};

    const [
      ocrCollection,
      tenderOcrCollection,
      bidderOcrCollection,
      evaluationsCollection,
      evaluationTracesCollection,
      uploadEventsCollection,
    ] = await Promise.all([
      getOcrCollection(),
      getTenderOcrCollection(),
      getBidderOcrCollection(),
      getEvaluationsCollection(),
      getEvaluationTracesCollection(),
      getUploadEventsCollection(),
    ]);

    const [
      legacyOcrCount,
      tenderPolicyOcrCount,
      bidderDocumentOcrCount,
      evaluationCount,
      evaluationTraceCount,
      uploadEventCount,
      latestEvaluation,
      latestTrace,
    ] = await Promise.all([
      ocrCollection.countDocuments(filter),
      tenderOcrCollection.countDocuments(filter),
      bidderOcrCollection.countDocuments(filter),
      evaluationsCollection.countDocuments(filter),
      evaluationTracesCollection.countDocuments(filter),
      uploadEventsCollection.countDocuments(filter),
      evaluationsCollection.find(filter).sort({ updated_at: -1, created_at: -1 }).limit(1).next(),
      evaluationTracesCollection.find(filter).sort({ created_at: -1 }).limit(1).next(),
    ]);

    return res.json({
      success: true,
      tender_id: tenderId || null,
      collections: {
        legacy_ocr: MONGODB_OCR_COLLECTION,
        tender_policy_ocr: MONGODB_TENDER_OCR_COLLECTION,
        bidder_document_ocr: MONGODB_BIDDER_OCR_COLLECTION,
        evaluations: MONGODB_EVALUATIONS_COLLECTION,
        evaluation_traces: MONGODB_EVALUATION_TRACES_COLLECTION,
        upload_events: MONGODB_UPLOAD_EVENTS_COLLECTION,
      },
      counts: {
        legacy_ocr: legacyOcrCount,
        tender_policy_ocr: tenderPolicyOcrCount,
        bidder_document_ocr: bidderDocumentOcrCount,
        evaluations: evaluationCount,
        evaluation_traces: evaluationTraceCount,
        upload_events: uploadEventCount,
      },
      latest: {
        evaluation: latestEvaluation
          ? {
            evaluation_key: latestEvaluation._id,
            tender_id: latestEvaluation.tender_id,
            bidder_id: latestEvaluation.bidder_id,
            criterion_id: latestEvaluation.criterion_id,
            decision: latestEvaluation.decision,
            ai_provider: latestEvaluation.ai_provider,
            updated_at: latestEvaluation.updated_at || latestEvaluation.created_at || null,
          }
          : null,
        evaluation_trace: latestTrace
          ? {
            evaluation_key: latestTrace.evaluation_key,
            decision: latestTrace.decision,
            ai_provider: latestTrace.ai_provider,
            duration_ms: latestTrace.duration_ms,
            created_at: latestTrace.created_at || null,
          }
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load observability summary',
    });
  }
});

app.get('/api/observability/records', async (req, res) => {
  try {
    const kind = String(req.query.kind || '').trim();
    const tenderId = String(req.query.tender_id || '').trim();
    const bidderId = String(req.query.bidder_id || '').trim();
    const limitRaw = Number(req.query.limit || 25);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 25;

    const filter = {};
    if (tenderId) filter.tender_id = tenderId;
    if (bidderId) filter.bidder_id = bidderId;

    const loaders = {
      tender_policy_ocr: async () => getTenderOcrCollection(),
      bidder_document_ocr: async () => getBidderOcrCollection(),
      evaluations: async () => getEvaluationsCollection(),
      evaluation_traces: async () => getEvaluationTracesCollection(),
      upload_events: async () => getUploadEventsCollection(),
    };

    if (!Object.prototype.hasOwnProperty.call(loaders, kind)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid kind. Use one of: tender_policy_ocr, bidder_document_ocr, evaluations, evaluation_traces, upload_events',
      });
    }

    const collection = await loaders[kind]();
    const sort = kind === 'evaluations' ? { updated_at: -1, created_at: -1 } : { created_at: -1 };
    const records = await collection.find(filter).sort(sort).limit(limit).toArray();

    return res.json({
      success: true,
      kind,
      filter,
      count: records.length,
      records,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch observability records',
    });
  }
});

app.get('/api/state', async (_req, res) => {
  try {
    const envelope = await readStateEnvelope();
    if (!envelope || !envelope.state) {
      return res.status(404).json({ success: false, message: 'State not found in MongoDB.' });
    }
    return res.json({ success: true, version: envelope.version, state: envelope.state });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read state',
    });
  }
});

app.put('/api/state', async (req, res) => {
  try {
    const parsed = statePutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const { expected_version, state } = parsed.data;
    const collection = await getStateCollection();
    const current = await readStateEnvelope();
    const currentVersion = current?.version ?? 0;

    if (expected_version !== currentVersion) {
      return res.status(409).json({
        success: false,
        error: 'Version conflict',
        current_version: currentVersion,
      });
    }

    const nextVersion = currentVersion + 1;
    const now = new Date();

    const writeResult = await collection.updateOne(
      { _id: STATE_DOC_ID, version: currentVersion },
      {
        $set: {
          state,
          version: nextVersion,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
        },
      },
      { upsert: currentVersion === 0 }
    );

    if (writeResult.matchedCount === 0 && writeResult.upsertedCount === 0) {
      const latest = await readStateEnvelope();
      return res.status(409).json({
        success: false,
        error: 'Version conflict',
        current_version: latest?.version ?? 0,
      });
    }

    return res.json({ success: true, version: nextVersion });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 11000) {
      const latest = await readStateEnvelope();
      return res.status(409).json({
        success: false,
        error: 'Version conflict',
        current_version: latest?.version ?? 0,
      });
    }
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to persist state',
    });
  }
});

app.post('/api/files/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: err.code === 'LIMIT_FILE_SIZE'
          ? `File exceeds ${MAX_UPLOAD_MB} MB limit.`
          : err.message,
      });
    }
    if (err) {
      return res.status(400).json({ success: false, error: 'Invalid upload payload.' });
    }
    return next();
  });
}, async (req, res) => {
  try {
    const file = req.file;
    const bidderId = String(req.body?.bidder_id || '');
    const tenderId = String(req.body?.tender_id || '');
    const scope = String(req.body?.scope || 'bidder');

    if (!file) {
      return res.status(400).json({ success: false, error: 'Missing file.' });
    }
    if (!['bidder', 'tender'].includes(scope)) {
      return res.status(400).json({ success: false, error: 'Invalid scope.' });
    }

    const safeName = file.originalname.replace(/\s+/g, '_');
    const key = scope === 'tender'
      ? `${S3_TENDER_PREFIX}/${tenderId || 'unassigned'}/${Date.now()}_${safeName}`
      : `${S3_BIDDER_PREFIX}/${tenderId || 'unassigned'}/${bidderId || 'unknown'}/${Date.now()}_${safeName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || 'application/octet-stream',
      })
    );

    try {
      const uploadEventsCollection = await getUploadEventsCollection();
      await uploadEventsCollection.insertOne({
        scope: scope === 'tender' ? 'tender_policy' : 'bidder_document',
        tender_id: tenderId || null,
        bidder_id: bidderId || null,
        file_name: file.originalname,
        file_size: file.size,
        content_type: file.mimetype || 'application/octet-stream',
        s3_key: key,
        created_at: new Date(),
      });
    } catch (error) {
      console.warn('[upload] Failed to write upload observability event:', error instanceof Error ? error.message : 'Unknown error');
    }

    return res.status(201).json({
      success: true,
      key,
      file_name: file.originalname,
      file_size: file.size,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'File upload failed',
    });
  }
});

app.get('/api/files/signed-url', async (req, res) => {
  try {
    const key = String(req.query.key || '');
    const expiresInRaw = Number(req.query.expires_in || 900);
    const expiresIn = Number.isFinite(expiresInRaw) ? Math.min(Math.max(expiresInRaw, 60), 3600) : 900;

    if (!key) {
      return res.status(400).json({ success: false, error: 'Missing key.' });
    }

    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }),
      { expiresIn }
    );

    return res.json({ success: true, signed_url: signedUrl, expires_in: expiresIn });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate signed URL',
    });
  }
});

app.delete('/api/files', async (req, res) => {
  try {
    const key = String(req.query.key || '');
    if (!key) {
      return res.status(400).json({ success: false, error: 'Missing key.' });
    }

    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'File delete failed',
    });
  }
});

app.post('/api/ocr', async (req, res) => {
  let requestMetaForError = null;
  let sourceScopeForError = 'bidder_document';
  try {
    const parsed = ocrSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const { file_base64, file_url, language, file_id, tender_id, bidder_id } = parsed.data;
    const sourceScope = resolveDocumentScope(parsed.data);

    const ocrCollection = await getOcrCollection();
    const dedicatedOcrCollection = sourceScope === 'tender_policy'
      ? await getTenderOcrCollection()
      : await getBidderOcrCollection();
    const requestMeta = {
      file_id: file_id || null,
      source_scope: sourceScope,
      tender_id: tender_id || null,
      bidder_id: bidder_id || null,
      file_url: file_url || null,
      has_file_base64: Boolean(file_base64),
      language: language || 'hi,en',
      created_at: new Date(),
    };
    requestMetaForError = requestMeta;
    sourceScopeForError = sourceScope;

    if (SARVAM_API_KEY) {
      const payload = {
        model: 'dococr',
        language: language || 'hi,en',
        ...(file_base64 ? { file_base64 } : {}),
        ...(file_url ? { file_url } : {}),
      };

      const { response, raw, parsed } = await fetchJsonWithTimeout(SARVAM_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': SARVAM_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Sarvam OCR failed (${response.status}): ${raw}`);
      }

      const result = parsed || {};
      const text = extractSarvamText(result);
      const record = {
        ...requestMeta,
        provider: 'sarvam',
        text: text || '',
        raw_response: result,
      };
      await Promise.all([
        ocrCollection.insertOne(record),
        dedicatedOcrCollection.insertOne(record),
      ]);
      return res.json({ success: true, text: text || '', provider: 'sarvam' });
    }

    const localText = `Simulated OCR output${file_url ? ` for ${file_url}` : ''}`;
    const record = {
      ...requestMeta,
      provider: 'local',
      text: localText,
      raw_response: null,
    };
    await Promise.all([
      ocrCollection.insertOne(record),
      dedicatedOcrCollection.insertOne(record),
    ]);

    return res.json({
      success: true,
      text: localText,
      provider: 'local',
    });
  } catch (error) {
    try {
      const ocrCollection = await getOcrCollection();
      const dedicatedOcrCollection = sourceScopeForError === 'tender_policy'
        ? await getTenderOcrCollection()
        : await getBidderOcrCollection();
      const errorRecord = {
        ...(requestMetaForError || {
          file_id: null,
          source_scope: sourceScopeForError,
          tender_id: null,
          bidder_id: null,
          file_url: null,
          has_file_base64: false,
          language: 'hi,en',
          created_at: new Date(),
        }),
        provider: 'error',
        text: '',
        raw_response: null,
        error_message: error instanceof Error ? error.message : 'OCR failed',
        failed_at: new Date(),
      };
      await Promise.all([
        ocrCollection.insertOne(errorRecord),
        dedicatedOcrCollection.insertOne(errorRecord),
      ]);
    } catch (persistError) {
      console.warn('[ocr] Failed to write OCR error observability record:', persistError instanceof Error ? persistError.message : 'Unknown error');
    }
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'OCR failed',
    });
  }
});

app.post('/api/evaluate', async (req, res) => {
  try {
    const parsed = evaluateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const evaluationData = parsed.data;
    const { tender_id, bidder_id, criterion_id } = evaluationData;

    const startedAt = Date.now();
    // Get AI evaluation
    const aiResult = await evaluateWithLLM(evaluationData);
    const completedAt = Date.now();

    // Create evaluation record
    const evaluation = {
      _id: `${tender_id}:${bidder_id}:${criterion_id}`,
      tender_id,
      bidder_id,
      bidder_name: evaluationData.bidder_name,
      criterion_id,
      criterion_name: evaluationData.criterion_name,
      criterion_category: evaluationData.criterion_category,
      criterion_weight: evaluationData.criterion_weight,
      criterion_threshold: evaluationData.criterion_threshold,
      extracted_value: aiResult.extracted_value || '',
      decision: normalizeDecision(aiResult.decision),
      confidence: normalizeConfidence(aiResult.confidence),
      source_document: evaluationData.source_document || 'N/A',
      explanation: aiResult.explanation || '',
      ai_provider: aiResult.provider || 'unknown',
      created_at: new Date(),
      updated_at: new Date(),
    };

    let persisted = true;
    let persistenceError = '';
    if (canAttemptMongoWrite()) {
      try {
        const evaluationsCollection = await getEvaluationsCollection();
        await evaluationsCollection.updateOne(
          { _id: evaluation._id },
          { $set: evaluation },
          { upsert: true }
        );
      } catch (error) {
        persisted = false;
        persistenceError = error instanceof Error ? error.message : 'Failed to persist evaluation';
        noteMongoWriteFailure(persistenceError);
        console.warn('[evaluate] Mongo persist failed:', persistenceError);
      }
    } else {
      persisted = false;
      persistenceError = lastMongoWriteError || 'MongoDB write temporarily skipped due to recent connection failure.';
    }

    try {
      const evaluationTracesCollection = await getEvaluationTracesCollection();
      await evaluationTracesCollection.insertOne({
        evaluation_key: evaluation._id,
        tender_id,
        bidder_id,
        bidder_name: evaluationData.bidder_name,
        criterion_id,
        criterion_name: evaluationData.criterion_name,
        criterion_category: evaluationData.criterion_category || null,
        criterion_weight: evaluationData.criterion_weight || null,
        criterion_threshold: evaluationData.criterion_threshold || null,
        source_document: evaluationData.source_document || null,
        ocr_text_length: typeof evaluationData.ocr_text === 'string' ? evaluationData.ocr_text.length : 0,
        ocr_excerpt: typeof evaluationData.ocr_text === 'string' ? evaluationData.ocr_text.slice(0, 2000) : '',
        ai_provider: evaluation.ai_provider,
        decision: evaluation.decision,
        confidence: evaluation.confidence,
        extracted_value: evaluation.extracted_value,
        explanation: evaluation.explanation,
        duration_ms: completedAt - startedAt,
        evaluation_persisted: persisted,
        evaluation_persistence_error: persisted ? null : persistenceError,
        created_at: new Date(),
      });
    } catch (error) {
      console.warn('[evaluate] Failed to write evaluation trace:', error instanceof Error ? error.message : 'Unknown error');
    }

    return res.json({
      success: true,
      persisted,
      ...(persisted ? {} : { persistence_error: persistenceError }),
      evaluation: {
        id: evaluation._id,
        tender_id: evaluation.tender_id,
        bidder_id: evaluation.bidder_id,
        bidder_name: evaluation.bidder_name,
        criterion_id: evaluation.criterion_id,
        criterion_name: evaluation.criterion_name,
        extracted_value: evaluation.extracted_value,
        decision: evaluation.decision,
        confidence: evaluation.confidence,
        source_document: evaluation.source_document,
        explanation: evaluation.explanation,
        ai_provider: evaluation.ai_provider,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Evaluation failed',
    });
  }
});

app.get('/api/evaluations/:tenderId', async (req, res) => {
  try {
    const { tenderId } = req.params;
    if (!tenderId) {
      return res.status(400).json({ success: false, error: 'Missing tenderId.' });
    }

    const evaluationsCollection = await getEvaluationsCollection();
    const evaluations = await evaluationsCollection
      .find({ tender_id: tenderId })
      .sort({ created_at: -1 })
      .toArray();

    return res.json({
      success: true,
      evaluations: evaluations.map((e) => ({
        id: e._id,
        tender_id: e.tender_id,
        bidder_id: e.bidder_id,
        bidder_name: e.bidder_name,
        criterion_id: e.criterion_id,
        criterion_name: e.criterion_name,
        extracted_value: e.extracted_value,
        decision: e.decision,
        confidence: e.confidence,
        source_document: e.source_document,
        explanation: e.explanation,
        ai_provider: e.ai_provider,
        created_at: e.created_at,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch evaluations',
    });
  }
});

app.listen(PORT, () => {
  console.log(`S3 API server running on http://localhost:${PORT}`);
});
