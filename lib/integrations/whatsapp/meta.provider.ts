export interface WAMessagePayload {
  to: string;
  text: string;
}

export class MetaWhatsAppProvider {
  private token: string;
  private phoneId: string;

  constructor() {
    this.token = process.env.WHATSAPP_API_TOKEN || '';
    this.phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  async sendMessage(payload: WAMessagePayload) {
    const url = `https://graph.facebook.com/v19.0/${this.phoneId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: payload.to,
        type: 'text',
        text: { body: payload.text },
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      console.error('[Meta WA Error]', error);
      throw new Error('Failed to send WA message');
    }
    return res.json();
  }

  // Verifikasi signature dari Meta (X-Hub-Signature-256)
  verifySignature(payload: string, signature: string | null): boolean {
    if (!signature) return false;
    const crypto = require('crypto');
    const expected = 'sha256=' + crypto
      .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET || '')
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}