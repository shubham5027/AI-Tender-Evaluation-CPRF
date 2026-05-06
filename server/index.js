import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { z } from 'zod';
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
const DB_KEY = process.env.S3_DB_KEY || 'tendereval/state.json';
const SARVAM_API_URL = process.env.SARVAM_API_URL || 'https://api.sarvam.ai/v1/ocr';
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';
const S3_BIDDER_PREFIX = process.env.S3_BIDDER_PREFIX || 'Bidder_Documents';
const S3_TENDER_PREFIX = process.env.S3_TENDER_PREFIX || 'Tendor_Policy_Doc';
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || '';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 50);

if (!BUCKET) {
  throw new Error('Missing S3_BUCKET_NAME in environment.');
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

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function normalizeStateEnvelope(payload) {
  if (!payload || typeof payload !== 'object') {
    return { version: 0, state: null };
  }

  const maybe = payload;
  if (typeof maybe.version === 'number' && maybe.state && typeof maybe.state === 'object') {
    return { version: maybe.version, state: maybe.state };
  }

  // Legacy shape fallback (raw state object stored directly)
  return { version: 1, state: maybe };
}

async function readStateEnvelope() {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: DB_KEY,
      })
    );
    const raw = await streamToString(response.Body);
    const parsed = JSON.parse(raw);
    return normalizeStateEnvelope(parsed);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code === 'NoSuchKey' || code === 'NotFound') {
      return null;
    }
    throw error;
  }
}

async function writeStateEnvelope(envelope) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: DB_KEY,
      Body: JSON.stringify(envelope),
      ContentType: 'application/json',
      CacheControl: 'no-cache',
    })
  );
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

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', authMiddleware);

app.get('/api/state', async (_req, res) => {
  try {
    const envelope = await readStateEnvelope();
    if (!envelope || !envelope.state) {
      return res.status(404).json({ success: false, message: 'State not found in S3.' });
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
    await writeStateEnvelope({ version: nextVersion, state });

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
      return res.json({ success: true, text: text || '', provider: 'sarvam' });
    }

    return res.json({
      success: true,
      text: `Simulated OCR output${file_url ? ` for ${file_url}` : ''}`,
      provider: 'local',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'OCR failed',
    });
  }
});

app.listen(PORT, () => {
  console.log(`S3 API server running on http://localhost:${PORT}`);
});
