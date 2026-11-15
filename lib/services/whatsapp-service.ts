import { createClient } from '@supabase/supabase-js';
import { MetaWhatsAppProvider } from '../integrations/whatsapp/meta.provider';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Wajib Service Role untuk bypass RLS saat webhook
);

const waProvider = new MetaWhatsAppProvider();

// Role yang diizinkan per command
const COMMAND_PERMISSIONS: Record<string, string[]> = {
  'HADIR': ['field', 'supervisor', 'admin'],
  'SAKIT': ['field', 'supervisor', 'admin'],
  'PROGRES': ['field', 'supervisor', 'admin'],
  'MASUK': ['supervisor', 'admin'],
  'KELUAR': ['supervisor', 'admin'],
  'BBM': ['field', 'supervisor', 'admin'],
  'MASUK-KAS': ['admin'],
  'KELUAR-KAS': ['admin'],
  'SALDO': ['admin'],
};

export async function processIncomingMessage({ from, text, messageId }: { from: string, text: string, messageId: string }) {
  // 1. Cek Idempotency (jangan proses 2x jika Meta retry)
  const { data: existingMsg } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('id')
    .eq('provider_message_id', messageId)
    .single();
    
  if (existingMsg) return; // Sudah diproses

  // 2. Cari Kontak
  const { data: contact } = await supabaseAdmin
    .from('whatsapp_contacts')
    .select('*, project_members(role)')
    .eq('phone_number', from)
    .is('deleted_at', null)
    .single();

  if (!contact) {
    await waProvider.sendMessage({ to: from, text: '⚠️ Nomor Anda belum terdaftar di sistem InfraControl PRO.' });
    return;
  }

  const projectId = contact.project_id;
  const userRole = contact.project_members.role;

  // Log Inbound
  await supabaseAdmin.from('whatsapp_messages').insert({
    project_id: projectId,
    contact_id: contact.id,
    direction: 'inbound',
    from_number: from,
    to_number: process.env.WHATSAPP_PHONE_ID!, 
    content: text,
    provider_message_id: messageId,
    processed: true
  });

  // 3. Cek Session Aktif (untuk guided flow)
  const { data: session } = await supabaseAdmin
    .from('whatsapp_sessions')
    .select('*')
    .eq('contact_id', contact.id)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (session) {
    await handleSessionFlow(session, text, contact);
    return;
  }

  // 4. Parsing Command Biasa (Shortcut Mode)
  const parts = text.trim().toUpperCase().split(' ');
  const command = parts[0];

  if (command === 'BANTUAN' || command === 'HELP') {
    await sendHelpMenu(contact);
    return;
  }

  // Cek RBAC
  const allowedRoles = COMMAND_PERMISSIONS[command];
  if (!allowedRoles || !allowedRoles.includes(userRole)) {
    await waProvider.sendMessage({ to: from, text: '❌ Maaf, Anda tidak memiliki akses untuk perintah ini.' });
    return;
  }

  // Route ke Parser
  switch (command) {
    case 'PROGRES':
      await handleProgress(parts, contact);
      break;
    case 'MASUK':
      await handleMaterialIn(parts, contact);
      break;
    case 'BBM':
      await handleFuel(parts, contact);
      break;
    default:
      await waProvider.sendMessage({ to: from, text: '❓ Perintah tidak dikenali. Ketik BANTUAN.' });
  }
}

// --- CONTOH IMPLEMENTASI PARSER ---

async function handleProgress(parts: string[], contact: any) {
  const wbsCode = parts[1];
  const percent = parseFloat(parts[2]);

  if (!wbsCode || isNaN(percent) || percent < 0 || percent > 100) {
    await waProvider.sendMessage({ 
      to: contact.phone_number, 
      text: '⚠️ Format salah.\nGunakan: `PROGRES <kode_wbs> <persen>`\nContoh: `PROGRES WBS-012 45`' 
    });
    return;
  }

  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('id, name')
    .eq('project_id', contact.project_id)
    .eq('code', wbsCode)
    .single();

  if (!task) {
    await waProvider.sendMessage({ to: contact.phone_number, text: `❌ WBS dengan kode ${wbsCode} tidak ditemukan.` });
    return;
  }

  await waProvider.sendMessage({ 
    to: contact.phone_number, 
    text: `✅ Progres ${wbsCode} (${task.name}) berhasil diupdate menjadi ${percent}%.` 
  });
}

async function handleMaterialIn(parts: string[], contact: any) {
  if (parts.length < 3) {
    await supabaseAdmin.from('whatsapp_sessions').insert({
      contact_id: contact.id,
      project_id: contact.project_id,
      flow: 'material-in',
      state: 'await_material_code',
      payload: {}
    });
    await waProvider.sendMessage({ 
      to: contact.phone_number, 
      text: '📦 *Input Material Masuk*\nSilakan ketik Kode/Nama Material:' 
    });
    return;
  }
}

// ==========================================
// DUMMY FUNCTIONS (Ditaruh paling bawah, di luar fungsi lain)
// Akan diisi saat Sprint WhatsApp Bot dilanjutkan
// ==========================================

async function handleSessionFlow(session: any, text: string, contact: any) {
  console.log("WhatsApp flow pending", session, text, contact);
}

async function sendHelpMenu(contact: any) {
  console.log("Send help menu to", contact.phone_number);
}

async function handleFuel(parts: string[], contact: any) {
  console.log("Handle fuel", parts, contact);
}