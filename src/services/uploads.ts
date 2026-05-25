import crypto from 'node:crypto';
import { getTenantDb } from '../lib/db/tenantSession.js';

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? '';
const S3_BUCKET = process.env.S3_BUCKET ?? 'marineflow-uploads';
const S3_REGION = process.env.S3_REGION ?? 'auto';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? '';
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL ?? '';

interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
}

export async function generatePresignedUpload(
  salonId: string,
  filename: string,
  mimeType: string,
  purpose: string = 'general',
): Promise<PresignedUploadResult> {
  const ext = filename.split('.').pop() ?? 'bin';
  const fileKey = `${salonId}/${purpose}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const expiry = 3600;
  const uploadUrl = await createPresignedPutUrl(fileKey, mimeType, expiry);
  const publicUrl = S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${fileKey}` : `${S3_ENDPOINT}/${S3_BUCKET}/${fileKey}`;

  return { uploadUrl, fileKey, publicUrl };
}

export async function confirmUpload(
  salonId: string,
  fileKey: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
  purpose: string,
  uploadedBy?: string,
) {
  const db = getTenantDb();
  const publicUrl = S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${fileKey}` : `${S3_ENDPOINT}/${S3_BUCKET}/${fileKey}`;

  return db.uploadedFile.create({
    data: {
      salonId,
      key: fileKey,
      filename,
      mimeType,
      sizeBytes,
      purpose,
      uploadedBy,
      url: publicUrl,
    },
  });
}

export async function listUploads(purpose?: string) {
  const db = getTenantDb();
  return db.uploadedFile.findMany({
    where: purpose ? { purpose } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function deleteUpload(fileId: string) {
  const db = getTenantDb();
  const file = await db.uploadedFile.findUnique({ where: { id: fileId } });
  if (!file) return null;

  // Delete from S3
  await deleteS3Object(file.key);

  // Delete from DB
  await db.uploadedFile.delete({ where: { id: fileId } });
  return file;
}

// ─── S3 Helpers (AWS Signature V4 compatible) ────────────────────────

async function createPresignedPutUrl(key: string, contentType: string, expiresIn: number): Promise<string> {
  if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
    // Fallback for local dev — return a mock URL
    return `http://localhost:9000/${S3_BUCKET}/${key}?mock=true`;
  }

  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8);
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, 'Z');
  const credential = `${S3_ACCESS_KEY}/${dateStamp}/${S3_REGION}/s3/aws4_request`;

  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'content-type;host',
  });

  const host = new URL(S3_ENDPOINT).host;
  const canonicalUri = `/${S3_BUCKET}/${key}`;
  const canonicalQueryString = params.toString().split('&').sort().join('&');
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';

  const canonicalRequest = [
    'PUT', canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate,
    `${dateStamp}/${S3_REGION}/s3/aws4_request`,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signingKey = getSignatureKey(S3_SECRET_KEY, dateStamp, S3_REGION, 's3');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  params.set('X-Amz-Signature', signature);

  return `${S3_ENDPOINT}${canonicalUri}?${params.toString()}`;
}

async function deleteS3Object(key: string): Promise<void> {
  if (!S3_ENDPOINT || !S3_ACCESS_KEY) return;

  const url = `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
  await fetch(url, { method: 'DELETE' }).catch(() => {});
}

function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  return crypto.createHmac('sha256', kService).update('aws4_request').digest();
}
