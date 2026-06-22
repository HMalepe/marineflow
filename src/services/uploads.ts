import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? '';
const S3_BUCKET = process.env.S3_BUCKET ?? 'marineflow-uploads';
const S3_REGION = process.env.S3_REGION ?? 'auto';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? '';
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL ?? '';

export const CAMPAIGN_MEDIA_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
] as const;

export const WHATSAPP_TEMPLATE_MEDIA_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 16 * 1024 * 1024;

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
}

export function validateUploadPurpose(
  purpose: string,
  mimeType: string,
  sizeBytes: number,
): void {
  if (purpose === 'staff') {
    if (!mimeType.startsWith('image/')) {
      throw new UploadError('Staff photos must be JPEG, PNG, or WebP.');
    }
    if (sizeBytes > IMAGE_MAX_BYTES) {
      throw new UploadError('Images must be under 5 MB.');
    }
    return;
  }
  if (purpose === 'campaign') {
    if (!CAMPAIGN_MEDIA_MIMES.includes(mimeType as (typeof CAMPAIGN_MEDIA_MIMES)[number])) {
      throw new UploadError('Newsletter media must be JPEG, PNG, WebP, GIF, or MP4 video.');
    }
    const isVideo = mimeType.startsWith('video/');
    const max = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
    if (sizeBytes > max) {
      throw new UploadError(
        isVideo ? 'Videos must be under 16 MB.' : 'Images and GIFs must be under 5 MB.',
      );
    }
  }
  if (purpose === 'whatsapp-template') {
    if (!WHATSAPP_TEMPLATE_MEDIA_MIMES.includes(mimeType as (typeof WHATSAPP_TEMPLATE_MEDIA_MIMES)[number])) {
      throw new UploadError('Template header images must be JPEG, PNG, or WebP.');
    }
    if (sizeBytes > IMAGE_MAX_BYTES) {
      throw new UploadError('Header images must be under 5 MB.');
    }
  }
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

/** Upload via API (server-side PUT) — avoids browser CORS issues with S3/R2. */
export async function uploadBuffer(
  salonId: string,
  filename: string,
  mimeType: string,
  purpose: string,
  buffer: Buffer,
  uploadedBy?: string,
): Promise<{ publicUrl: string; fileKey: string; file: Awaited<ReturnType<typeof confirmUpload>> }> {
  validateUploadPurpose(purpose, mimeType, buffer.length);

  const { uploadUrl, fileKey, publicUrl: defaultPublicUrl } = await generatePresignedUpload(
    salonId,
    filename,
    mimeType,
    purpose,
  );

  let publicUrl = defaultPublicUrl;

  if (S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY) {
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: buffer as unknown as BodyInit,
    });
    if (!putRes.ok) {
      throw new UploadError('Storage upload failed — check S3 configuration.');
    }
  } else if (
    (purpose === 'campaign' || purpose === 'staff') &&
    mimeType.startsWith('image/') &&
    buffer.length <= IMAGE_MAX_BYTES
  ) {
    publicUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
  } else {
    throw new UploadError('File storage is not configured on the server.');
  }

  const file = await confirmUpload(
    salonId,
    fileKey,
    filename,
    mimeType,
    buffer.length,
    purpose,
    uploadedBy,
    publicUrl,
  );

  return { publicUrl, fileKey, file };
}

function isUploadedFileTableMissing(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('UploadedFile') && msg.includes('does not exist');
}

export async function confirmUpload(
  salonId: string,
  fileKey: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
  purpose: string,
  uploadedBy?: string,
  urlOverride?: string,
) {
  const db = getTenantDb();
  const publicUrl =
    urlOverride ??
    (S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${fileKey}` : `${S3_ENDPOINT}/${S3_BUCKET}/${fileKey}`);

  const row = {
    salonId,
    key: fileKey,
    filename,
    mimeType,
    sizeBytes,
    purpose,
    uploadedBy: uploadedBy ?? null,
    url: publicUrl,
  };

  try {
    return await db.uploadedFile.create({ data: row });
  } catch (err) {
    if (!isUploadedFileTableMissing(err)) throw err;
    return {
      id: `upload-${crypto.randomUUID()}`,
      createdAt: new Date(),
      ...row,
    };
  }
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
