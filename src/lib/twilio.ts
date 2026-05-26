import twilio from 'twilio';
import { env, isTwilioConfigured } from '../config.js';

let client: ReturnType<typeof twilio> | null = null;

export function getTwilioClient(): ReturnType<typeof twilio> | null {
  if (!isTwilioConfigured()) return null;
  if (!client) {
    client = twilio(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!);
  }
  return client;
}

export async function sendWhatsAppReply(toWaId: string, body: string): Promise<string | null> {
  const tw = getTwilioClient();
  if (!tw || !env.TWILIO_WHATSAPP_FROM) {
    // #region agent log
    fetch('http://127.0.0.1:7303/ingest/8de01daf-7e06-48b5-8401-fa1f790b3596',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e981d'},body:JSON.stringify({sessionId:'8e981d',location:'twilio.ts:no-client',message:'sendWhatsAppReply ABORTED - no client or from',data:{hasClient:!!tw,hasFrom:!!env.TWILIO_WHATSAPP_FROM},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    return null;
  }
  const to = toWaId.startsWith('whatsapp:') ? toWaId : `whatsapp:${toWaId}`;
  try {
    const msg = await tw.messages.create({
      from: env.TWILIO_WHATSAPP_FROM,
      to,
      body,
    });
    // #region agent log
    fetch('http://127.0.0.1:7303/ingest/8de01daf-7e06-48b5-8401-fa1f790b3596',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e981d'},body:JSON.stringify({sessionId:'8e981d',location:'twilio.ts:sent-ok',message:'Message sent successfully',data:{sid:msg.sid,to,bodyLen:body.length},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    return msg.sid;
  } catch (err: unknown) {
    // #region agent log
    fetch('http://127.0.0.1:7303/ingest/8de01daf-7e06-48b5-8401-fa1f790b3596',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e981d'},body:JSON.stringify({sessionId:'8e981d',location:'twilio.ts:send-error',message:'Twilio send FAILED',data:{error:String(err),to},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    throw err;
  }
}
