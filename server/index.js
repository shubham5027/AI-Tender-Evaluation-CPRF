import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { z } from 'zod';
import { MongoClient } from 'mongodb';
import {
  S3Client,
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
const SARVAM_LLM_API_KEY = process.env.SARVAM_LLM_API_KEY || SARVAM_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const S3_BIDDER_PREFIX = process.env.S3_BIDDER_PREFIX || 'Bidder_Documents';
const S3_TENDER_PREFIX = process.env.S3_TENDER_PREFIX || 'Tendor_Policy_Doc';
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || '';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 50);
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'tendereval';
const MONGODB_STATE_COLLECTION = process.env.MONGODB_STATE_COLLECTION || 'app_state';
const MONGODB_OCR_COLLECTION = process.env.MONGODB_OCR_COLLECTION || 'ocr_results';
const MONGODB_EVALUATIONS_COLLECTION = process.env.MONGODB_EVALUATIONS_COLLECTION || 'evaluations';
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

const mongoClient = new MongoClient(MONGODB_URI);
let mongoConnectPromise = null;

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

async function getEvaluationsCollection() {
  const db = await getMongoDb();
  return db.collection(MONGODB_EVALUATIONS_COLLECTION);
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

async function evaluateWithLLM(evaluationData) {
  const {
    criterion_name,
    criterion_description,
    criterion_threshold,
    criterion_weight,
    ocr_text,
    bidder_name,
  } = evaluationData;

  const prompt = `You are an expert tender evaluation assistant. Evaluate the bidder against the criterion based on the OCR-extracted document text.

Bidder Name: ${bidder_name}
Criterion: ${criterion_name}
Weight: ${criterion_weight || 'Not specified'}
Category: ${evaluationData.criterion_category || 'General'}
Description: ${criterion_description || 'No description'}
Threshold: ${criterion_threshold || 'Not specified'}

Document Text:
${ocr_text || 'No OCR text provided'}

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
      const response = await fetch(SARVAM_LLM_API_URL, {
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
        const result = await response.json();
        if (result.choices && result.choices[0]?.message?.content) {
          const content = result.choices[0].message.content.trim();
          try {
            const parsed = JSON.parse(content);
            return { ...parsed, provider: 'sarvam-llm' };
          } catch {
            // If JSON parsing fails, try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return { ...parsed, provider: 'sarvam-llm' };
            }
          }
        }
      }
    } catch (error) {
      console.warn('Sarvam LLM failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Fallback to OpenRouter
  if (OPENROUTER_API_KEY) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
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
        const result = await response.json();
        if (result.choices && result.choices[0]?.message?.content) {
          const content = result.choices[0].message.content.trim();
          try {
            const parsed = JSON.parse(content);
            return { ...parsed, provider: 'openrouter' };
          } catch {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return { ...parsed, provider: 'openrouter' };
            }
          }
        }
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
    decision,
    confidence,
    extracted_value,
    explanation: `Fallback evaluation: ${decision} with ${Math.round(confidence * 100)}% confidence.`,
    provider: 'fallback',
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, storage: 's3', database: 'mongodb' });
});

app.use('/api', authMiddleware);

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
  try {
    const parsed = ocrSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const { file_base64, file_url, language } = parsed.data;

    const ocrCollection = await getOcrCollection();
    const requestMeta = {
      file_url: file_url || null,
      has_file_base64: Boolean(file_base64),
      language: language || 'hi,en',
      created_at: new Date(),
    };

    if (SARVAM_API_KEY) {
      const payload = {
        model: 'dococr',
        language: language || 'hi,en',
        ...(file_base64 ? { file_base64 } : {}),
        ...(file_url ? { file_url } : {}),
      };

      const response = await fetch(SARVAM_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': SARVAM_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Sarvam OCR failed (${response.status}): ${errText}`);
      }

      const result = await response.json();
      const text = extractSarvamText(result);
      await ocrCollection.insertOne({
        ...requestMeta,
        provider: 'sarvam',
        text: text || '',
        raw_response: result,
      });
      return res.json({ success: true, text: text || '', provider: 'sarvam' });
    }

    const localText = `Simulated OCR output${file_url ? ` for ${file_url}` : ''}`;
    await ocrCollection.insertOne({
      ...requestMeta,
      provider: 'local',
      text: localText,
      raw_response: null,
    });

    return res.json({
      success: true,
      text: localText,
      provider: 'local',
    });
  } catch (error) {
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

    // Get AI evaluation
    const aiResult = await evaluateWithLLM(evaluationData);

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
      decision: aiResult.decision || 'Review',
      confidence: aiResult.confidence || 0.5,
      source_document: evaluationData.source_document || 'N/A',
      explanation: aiResult.explanation || '',
      ai_provider: aiResult.provider || 'unknown',
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Store in MongoDB
    const evaluationsCollection = await getEvaluationsCollection();
    await evaluationsCollection.updateOne(
      { _id: evaluation._id },
      { $set: evaluation },
      { upsert: true }
    );

    return res.json({
      success: true,
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
