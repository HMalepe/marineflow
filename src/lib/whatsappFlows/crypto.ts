/**
 * WhatsApp Flows — AES-256-GCM + RSA-OAEP hybrid encryption.
 *
 * Meta encrypts the data exchange payload like this:
 *   1. Generates a random AES-256 key + IV
 *   2. Encrypts payload with AES-256-GCM → ciphertext + auth tag
 *   3. Encrypts the AES key with our RSA public key (OAEP + SHA-256) → encrypted_aes_key
 *   4. Sends: { encrypted_aes_key, initial_vector, encrypted_flow_data }
 *
 * We reverse this to decrypt, then re-encrypt our response with the same AES key.
 * https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint
 */

import crypto from 'node:crypto';

export interface EncryptedFlowRequest {
  encrypted_aes_key: string; // Base64 RSA-OAEP encrypted AES key
  initial_vector: string;    // Base64 IV (12 bytes for GCM)
  encrypted_flow_data: string; // Base64 AES-256-GCM ciphertext + 16-byte tag appended
}

/**
 * Decrypt an incoming flow data exchange request.
 * @param privateKeyPem RSA private key in PEM format (FLOW_PRIVATE_KEY env var).
 */
export function decryptFlowRequest(
  body: EncryptedFlowRequest,
  privateKeyPem: string,
): { aesKey: Buffer; iv: Buffer; decrypted: unknown } {
  const encryptedAesKey = Buffer.from(body.encrypted_aes_key, 'base64');
  const iv = Buffer.from(body.initial_vector, 'base64');
  const encryptedData = Buffer.from(body.encrypted_flow_data, 'base64');

  // Decrypt AES key with our RSA private key
  const aesKey = crypto.privateDecrypt(
    { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    encryptedAesKey,
  );

  // Split ciphertext and GCM auth tag (last 16 bytes)
  const TAG_LENGTH = 16;
  const ciphertext = encryptedData.subarray(0, encryptedData.length - TAG_LENGTH);
  const authTag = encryptedData.subarray(encryptedData.length - TAG_LENGTH);

  // Decrypt payload
  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, iv);
  decipher.setAuthTag(authTag);
  const decryptedBuf = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const decrypted = JSON.parse(decryptedBuf.toString('utf8')) as unknown;

  return { aesKey, iv, decrypted };
}

/**
 * Encrypt our response using the same AES key Meta sent us.
 * We flip the IV bit 0 to generate a new IV (Meta's protocol).
 */
export function encryptFlowResponse(
  responseBody: unknown,
  aesKey: Buffer,
  iv: Buffer,
): string {
  // Flip first bit of IV per WhatsApp Flows spec
  const flippedIv = Buffer.from(iv);
  flippedIv[0] ^= 0xff;

  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(responseBody), 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return encrypted.toString('base64');
}
