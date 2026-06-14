import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { z } from 'zod';
import pg from 'pg';
const { Client } = pg;
import {
  S3Client,
  HeadBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  TextractClient,
  DetectDocumentTextCommand,
} from '@aws-sdk/client-textract';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

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
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || '';
const AWS_TEXTRACT_ENABLED = process.env.AWS_TEXTRACT_ENABLED === 'true';
const S3_BIDDER_PREFIX = process.env.S3_BIDDER_PREFIX || 'Bidder_Documents';
const S3_TENDER_PREFIX = process.env.S3_TENDER_PREFIX || 'Tendor_Policy_Doc';
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || '';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 50);
const EXTERNAL_AI_TIMEOUT_MS = Number(process.env.EXTERNAL_AI_TIMEOUT_MS || 8000);
const MAX_OCR_CHARS_FOR_EVAL = Number(process.env.MAX_OCR_CHARS_FOR_EVAL || 12000);
const DATABASE_URL = process.env.DATABASE_URL || '';
const STATE_DOC_ID = process.env.STATE_DOC_ID || 'current';

if (!BUCKET) {
  throw new Error('Missing S3_BUCKET_NAME in environment.');
}
if (!DATABASE_URL) {
  throw new Error('Missing DATABASE_URL in environment.');
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

const textract = new TextractClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const pgClient = new Client({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
});
let pgConnectPromise = null;
let pgWriteBackoffUntil = 0;
let lastPgWriteError = '';

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

async function getPostgresClient() {
  if (!pgConnectPromise) {
    pgConnectPromise = pgClient.connect();
  }
  await pgConnectPromise;
  return pgClient;
}

async function getStateTable() {
  return await getPostgresClient();
}

async function getOcrTable() {
  return await getPostgresClient();
}

async function getTenderOcrTable() {
  return await getPostgresClient();
}

async function getBidderOcrTable() {
  return await getPostgresClient();
}

async function getEvaluationsTable() {
  return await getPostgresClient();
}

async function getEvaluationTracesTable() {
  return await getPostgresClient();
}

async function getUploadEventsTable() {
  return await getPostgresClient();
}

function canAttemptPgWrite() {
  return Date.now() >= pgWriteBackoffUntil;
}

function notePgWriteFailure(message) {
  lastPgWriteError = message;
  pgWriteBackoffUntil = Date.now() + 60_000;
}

async function readStateEnvelope() {
  const client = await getStateTable();
  const result = await client.query(
    'SELECT version, state FROM app_state WHERE id = $1',
    [STATE_DOC_ID]
  );
  if (result.rows.length === 0) return null;
  const doc = result.rows[0];
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

async function performTextractOCR(fileBytes) {
  try {
    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: fileBytes,
      },
    });
    
    const response = await textract.send(command);
    
    // Extract text from Textract response
    if (response.Blocks && Array.isArray(response.Blocks)) {
      const textBlocks = response.Blocks
        .filter(block => block.BlockType === 'LINE')
        .map(block => block.Text)
        .filter(text => text);
      
      return textBlocks.join('\n');
    }
    
    return '';
  } catch (error) {
    console.error('Textract OCR failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
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

  // Try OpenRouter first (primary)
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

  // Fallback to Bedrock
  if (BEDROCK_MODEL_ID) {
    try {
      let body;
      let contentType = 'application/json';
      
      // Different models have different request formats
      if (BEDROCK_MODEL_ID.includes('anthropic') || BEDROCK_MODEL_ID.includes('claude')) {
        // Anthropic Claude format
        body = JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });
      } else if (BEDROCK_MODEL_ID.includes('amazon') || BEDROCK_MODEL_ID.includes('titan')) {
        // Amazon Titan format
        body = JSON.stringify({
          inputText: prompt,
          textGenerationConfig: {
            maxTokenCount: 500,
            temperature: 0.3,
          }
        });
      } else {
        // Generic format
        body = JSON.stringify({
          prompt: prompt,
          max_tokens: 500
        });
      }
      
      const command = new InvokeModelCommand({
        modelId: BEDROCK_MODEL_ID,
        contentType: contentType,
        body: body,
      });
      
      const response = await bedrock.send(command);
      
      if (response.$metadata.httpStatusCode === 200) {
        const responseBody = new TextDecoder().decode(response.body);
        let parsed;
        try {
          parsed = JSON.parse(responseBody);
        } catch {
          // If not JSON, return as is
          return {
            decision: 'Review',
            confidence: 0.5,
            extracted_value: responseBody.substring(0, 200),
            explanation: 'Bedrock response could not be parsed as JSON',
            provider: 'bedrock',
          };
        }
        
        // Extract text based on model format
        let extractedText = '';
        if (parsed.completion) {
          extractedText = parsed.completion;
        } else if (parsed.outputText) {
          extractedText = parsed.outputText;
        } else if (parsed.content && Array.isArray(parsed.content)) {
          extractedText = parsed.content.map(c => c.text).join('');
        } else if (parsed.message && parsed.message.content) {
          extractedText = parsed.message.content;
        }
        
        if (extractedText) {
          try {
            const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return {
                ...parsed,
                decision: normalizeDecision(parsed.decision),
                confidence: normalizeConfidence(parsed.confidence),
                provider: 'bedrock',
              };
            }
          } catch {
            return {
              decision: 'Review',
              confidence: 0.5,
              extracted_value: extractedText.substring(0, 200),
              explanation: 'Bedrock response could not be parsed as JSON',
              provider: 'bedrock',
            };
          }
        }
      }
    } catch (error) {
      console.warn('Bedrock failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Try Sarvam LLM as additional fallback
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
  res.json({ ok: true, storage: 's3', database: 'postgresql' });
});

app.get('/health/deps', async (_req, res) => {
  const result = {
    ok: false,
    postgres: { ok: false, error: '' },
    s3: { ok: false, error: '' },
  };

  try {
    const client = await getPostgresClient();
    await client.query('SELECT 1');
    result.postgres.ok = true;
  } catch (error) {
    result.postgres.error = error instanceof Error ? error.message : 'PostgreSQL check failed';
  }

  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    result.s3.ok = true;
  } catch (error) {
    result.s3.error = error instanceof Error ? error.message : 'S3 check failed';
  }

  result.ok = result.postgres.ok && result.s3.ok;
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
    postgres_write: {
      available: canAttemptPgWrite(),
      backoff_ms_remaining: Math.max(0, pgWriteBackoffUntil - now),
      last_error: lastPgWriteError,
    },
  });
});

app.use('/api', authMiddleware);

app.get('/api/observability/summary', async (req, res) => {
  try {
    const tenderId = String(req.query.tender_id || '').trim();
    const client = await getPostgresClient();

    const whereClause = tenderId ? 'WHERE tender_id = $1' : '';
    const params = tenderId ? [tenderId] : [];

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
      client.query(`SELECT COUNT(*) FROM ocr_results ${whereClause}`, params).then(r => parseInt(r.rows[0].count)),
      client.query(`SELECT COUNT(*) FROM tender_policy_ocr ${whereClause}`, params).then(r => parseInt(r.rows[0].count)),
      client.query(`SELECT COUNT(*) FROM bidder_document_ocr ${whereClause}`, params).then(r => parseInt(r.rows[0].count)),
      client.query(`SELECT COUNT(*) FROM evaluations ${whereClause}`, params).then(r => parseInt(r.rows[0].count)),
      client.query(`SELECT COUNT(*) FROM evaluation_traces ${whereClause}`, params).then(r => parseInt(r.rows[0].count)),
      client.query(`SELECT COUNT(*) FROM upload_events ${whereClause}`, params).then(r => parseInt(r.rows[0].count)),
      client.query(`SELECT * FROM evaluations ${whereClause} ORDER BY updated_at DESC, created_at DESC LIMIT 1`, params).then(r => r.rows[0] || null),
      client.query(`SELECT * FROM evaluation_traces ${whereClause} ORDER BY created_at DESC LIMIT 1`, params).then(r => r.rows[0] || null),
    ]);

    return res.json({
      success: true,
      tender_id: tenderId || null,
      collections: {
        legacy_ocr: 'ocr_results',
        tender_policy_ocr: 'tender_policy_ocr',
        bidder_document_ocr: 'bidder_document_ocr',
        evaluations: 'evaluations',
        evaluation_traces: 'evaluation_traces',
        upload_events: 'upload_events',
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
            evaluation_key: latestEvaluation.id,
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

    const tables = {
      tender_policy_ocr: 'tender_policy_ocr',
      bidder_document_ocr: 'bidder_document_ocr',
      evaluations: 'evaluations',
      evaluation_traces: 'evaluation_traces',
      upload_events: 'upload_events',
    };

    if (!Object.prototype.hasOwnProperty.call(tables, kind)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid kind. Use one of: tender_policy_ocr, bidder_document_ocr, evaluations, evaluation_traces, upload_events',
      });
    }

    const client = await getPostgresClient();
    const table = tables[kind];
    
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (tenderId) {
      conditions.push(`tender_id = $${paramIndex++}`);
      params.push(tenderId);
    }
    if (bidderId) {
      conditions.push(`bidder_id = $${paramIndex++}`);
      params.push(bidderId);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = kind === 'evaluations' ? 'ORDER BY updated_at DESC, created_at DESC' : 'ORDER BY created_at DESC';
    
    const query = `SELECT * FROM ${table} ${whereClause} ${orderBy} LIMIT $${paramIndex++}`;
    params.push(limit);
    
    const result = await client.query(query, params);

    return res.json({
      success: true,
      kind,
      filter: { tender_id: tenderId || null, bidder_id: bidderId || null },
      count: result.rows.length,
      records: result.rows,
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
      return res.status(404).json({ success: false, message: 'State not found in PostgreSQL.' });
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
    const client = await getStateTable();
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

    if (currentVersion === 0) {
      await client.query(
        'INSERT INTO app_state (id, version, state, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        [STATE_DOC_ID, nextVersion, JSON.stringify(state), now, now]
      );
    } else {
      const result = await client.query(
        'UPDATE app_state SET version = $1, state = $2, updated_at = $3 WHERE id = $4 AND version = $5',
        [nextVersion, JSON.stringify(state), now, STATE_DOC_ID, currentVersion]
      );
      if (result.rowCount === 0) {
        const latest = await readStateEnvelope();
        return res.status(409).json({
          success: false,
          error: 'Version conflict',
          current_version: latest?.version ?? 0,
        });
      }
    }

    return res.json({ success: true, version: nextVersion });
  } catch (error) {
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
      const client = await getUploadEventsTable();
      await client.query(
        'INSERT INTO upload_events (scope, tender_id, bidder_id, file_name, file_size, content_type, s3_key, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [scope === 'tender' ? 'tender_policy' : 'bidder_document', tenderId || null, bidderId || null, file.originalname, file.size, file.mimetype || 'application/octet-stream', key, new Date()]
      );
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

    const client = await getOcrTable();
    const dedicatedTable = sourceScope === 'tender_policy' ? 'tender_policy_ocr' : 'bidder_document_ocr';
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

    let text = '';
    let provider = 'local';
    let rawResponse = null;

    if (AWS_TEXTRACT_ENABLED) {
      try {
        let fileBytes = null;
        
        if (file_base64) {
          // Decode base64 to bytes
          const buffer = Buffer.from(file_base64, 'base64');
          fileBytes = buffer;
        } else if (file_url) {
          // Download file from S3
          const s3Key = file_url.includes('amazonaws.com') ? file_url.split('/').pop() : file_url;
          const getCommand = new GetObjectCommand({
            Bucket: BUCKET,
            Key: s3Key,
          });
          const s3Response = await s3.send(getCommand);
          const chunks = [];
          for await (const chunk of s3Response.Body) {
            chunks.push(chunk);
          }
          fileBytes = Buffer.concat(chunks);
        }

        if (fileBytes) {
          text = await performTextractOCR(fileBytes);
          provider = 'textract';
          rawResponse = { service: 'aws-textract' };
        } else {
          throw new Error('No file data provided for Textract OCR');
        }
      } catch (error) {
        console.error('Textract OCR failed, falling back to local:', error instanceof Error ? error.message : 'Unknown error');
        text = `Simulated OCR output${file_url ? ` for ${file_url}` : ''}`;
        provider = 'local';
        rawResponse = null;
      }
    } else if (SARVAM_API_KEY) {
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
      text = extractSarvamText(result);
      provider = 'sarvam';
      rawResponse = result;
    } else {
      text = `Simulated OCR output${file_url ? ` for ${file_url}` : ''}`;
      provider = 'local';
      rawResponse = null;
    }

    const record = {
      file_id: requestMeta.file_id,
      source_scope: requestMeta.source_scope,
      tender_id: requestMeta.tender_id,
      bidder_id: requestMeta.bidder_id,
      file_url: requestMeta.file_url,
      has_file_base64: requestMeta.has_file_base64,
      language: requestMeta.language,
      provider: provider,
      text: text || '',
      raw_response: rawResponse,
      created_at: requestMeta.created_at,
    };
    await Promise.all([
      client.query(
        'INSERT INTO ocr_results (file_id, source_scope, tender_id, bidder_id, file_url, has_file_base64, language, provider, text, raw_response, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [record.file_id, record.source_scope, record.tender_id, record.bidder_id, record.file_url, record.has_file_base64, record.language, record.provider, record.text, JSON.stringify(record.raw_response), record.created_at]
      ),
      client.query(
        `INSERT INTO ${dedicatedTable} (file_id, source_scope, tender_id, bidder_id, file_url, has_file_base64, language, provider, text, raw_response, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [record.file_id, record.source_scope, record.tender_id, record.bidder_id, record.file_url, record.has_file_base64, record.language, record.provider, record.text, JSON.stringify(record.raw_response), record.created_at]
      ),
    ]);
    return res.json({ success: true, text: text || '', provider: provider });
  } catch (error) {
    try {
      const client = await getOcrTable();
      const dedicatedTable = sourceScopeForError === 'tender_policy' ? 'tender_policy_ocr' : 'bidder_document_ocr';
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
        client.query(
          'INSERT INTO ocr_results (file_id, source_scope, tender_id, bidder_id, file_url, has_file_base64, language, provider, text, raw_response, error_message, failed_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
          [errorRecord.file_id, errorRecord.source_scope, errorRecord.tender_id, errorRecord.bidder_id, errorRecord.file_url, errorRecord.has_file_base64, errorRecord.language, errorRecord.provider, errorRecord.text, errorRecord.raw_response, errorRecord.error_message, errorRecord.failed_at, errorRecord.created_at]
        ),
        client.query(
          `INSERT INTO ${dedicatedTable} (file_id, source_scope, tender_id, bidder_id, file_url, has_file_base64, language, provider, text, raw_response, error_message, failed_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [errorRecord.file_id, errorRecord.source_scope, errorRecord.tender_id, errorRecord.bidder_id, errorRecord.file_url, errorRecord.has_file_base64, errorRecord.language, errorRecord.provider, errorRecord.text, errorRecord.raw_response, errorRecord.error_message, errorRecord.failed_at, errorRecord.created_at]
        ),
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
      tender_id,
      bidder_id,
      bidder_name: evaluationData.bidder_name,
      criterion_id,
      criterion_name: evaluationData.criterion_name,
      criterion_category: evaluationData.criterion_category,
      criterion_weight: evaluationData.criterion_weight,
      criterion_threshold: evaluationData.criterion_threshold,
      ocr_text: evaluationData.ocr_text,
      source_document: evaluationData.source_document || 'N/A',
      extracted_value: aiResult.extracted_value || '',
      decision: normalizeDecision(aiResult.decision),
      confidence: normalizeConfidence(aiResult.confidence),
      explanation: aiResult.explanation || '',
      ai_provider: aiResult.provider || 'unknown',
      created_at: new Date(),
      updated_at: new Date(),
    };

    let persisted = true;
    let persistenceError = '';
    if (canAttemptPgWrite()) {
      try {
        const client = await getEvaluationsTable();
        const existingResult = await client.query(
          'SELECT id FROM evaluations WHERE tender_id = $1 AND bidder_id = $2 AND criterion_id = $3',
          [tender_id, bidder_id, criterion_id]
        );
        
        if (existingResult.rows.length > 0) {
          await client.query(
            'UPDATE evaluations SET bidder_name = $1, criterion_name = $2, criterion_category = $3, criterion_weight = $4, criterion_threshold = $5, criterion_description = $6, ocr_text = $7, source_document = $8, extracted_value = $9, decision = $10, confidence = $11, explanation = $12, ai_provider = $13, updated_at = $14 WHERE tender_id = $15 AND bidder_id = $16 AND criterion_id = $17',
            [evaluation.bidder_name, evaluation.criterion_name, evaluation.criterion_category || null, evaluation.criterion_weight || null, evaluation.criterion_threshold || null, evaluation.criterion_description || null, evaluation.ocr_text || null, evaluation.source_document, evaluation.extracted_value, evaluation.decision, evaluation.confidence, evaluation.explanation, evaluation.ai_provider, evaluation.updated_at, tender_id, bidder_id, criterion_id]
          );
        } else {
          await client.query(
            'INSERT INTO evaluations (tender_id, bidder_id, bidder_name, criterion_id, criterion_name, criterion_category, criterion_weight, criterion_threshold, criterion_description, ocr_text, source_document, extracted_value, decision, confidence, explanation, ai_provider, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)',
            [evaluation.tender_id, evaluation.bidder_id, evaluation.bidder_name, evaluation.criterion_id, evaluation.criterion_name, evaluation.criterion_category || null, evaluation.criterion_weight || null, evaluation.criterion_threshold || null, evaluation.criterion_description || null, evaluation.ocr_text || null, evaluation.source_document, evaluation.extracted_value, evaluation.decision, evaluation.confidence, evaluation.explanation, evaluation.ai_provider, evaluation.created_at, evaluation.updated_at]
          );
        }
      } catch (error) {
        persisted = false;
        persistenceError = error instanceof Error ? error.message : 'Failed to persist evaluation';
        notePgWriteFailure(persistenceError);
        console.warn('[evaluate] PostgreSQL persist failed:', persistenceError);
      }
    } else {
      persisted = false;
      persistenceError = lastPgWriteError || 'PostgreSQL write temporarily skipped due to recent connection failure.';
    }

    try {
      const client = await getEvaluationTracesTable();
      const evaluationKeyResult = await client.query(
        'SELECT id FROM evaluations WHERE tender_id = $1 AND bidder_id = $2 AND criterion_id = $3',
        [tender_id, bidder_id, criterion_id]
      );
      const evaluationKey = evaluationKeyResult.rows.length > 0 ? evaluationKeyResult.rows[0].id : null;
      
      await client.query(
        'INSERT INTO evaluation_traces (evaluation_key, tender_id, bidder_id, criterion_id, decision, ai_provider, duration_ms, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [evaluationKey, tender_id, bidder_id, criterion_id, evaluation.decision, evaluation.ai_provider, completedAt - startedAt, new Date()]
      );
    } catch (error) {
      console.warn('[evaluate] Failed to write evaluation trace:', error instanceof Error ? error.message : 'Unknown error');
    }

    return res.json({
      success: true,
      persisted,
      ...(persisted ? {} : { persistence_error: persistenceError }),
      evaluation: {
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

    const client = await getEvaluationsTable();
    const result = await client.query(
      'SELECT * FROM evaluations WHERE tender_id = $1 ORDER BY created_at DESC',
      [tenderId]
    );

    return res.json({
      success: true,
      evaluations: result.rows.map((e) => ({
        id: e.id,
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
