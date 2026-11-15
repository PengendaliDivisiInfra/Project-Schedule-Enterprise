import { NextRequest, NextResponse } from 'next/server';
import { MetaWhatsAppProvider } from '@/lib/integrations/whatsapp/meta.provider';
import { processIncomingMessage } from '@/lib/services/whatsapp-service';

const provider = new MetaWhatsAppProvider();

// 1. Verifikasi Webhook (Saat pertama kali setup di dashboard Meta)
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// 2. Terima Pesan Masuk
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  if (!provider.verifySignature(rawBody, signature)) {
    return new NextResponse('Invalid Signature', { status: 401 });
  }

  const body = JSON.parse(rawBody);
  
  // Parse payload Meta (sangat nested)
  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message) {
      const from = message.from; // nomor HP
      const text = message.text?.body;
      const messageId = message.id;

      if (text) {
        // Proses secara async agar Meta tidak timeout (max 3 detik)
        // Di production, gunakan Queue (e.g., Upstash Redis) atau Supabase Edge Functions
        processIncomingMessage({ from, text, messageId }).catch(console.error);
      }
    }
  }

  return new NextResponse('OK', { status: 200 });
}