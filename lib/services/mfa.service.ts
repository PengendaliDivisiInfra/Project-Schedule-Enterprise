// lib/services/mfa.service.ts
import { supabase } from '@/lib/supabase';

export interface MfaStatus {
  currentLevel: string | null;
  nextLevel: string | null;
  verifiedFactors: Array<{ id: string; friendly_name?: string; created_at?: string }>;
  hasTotp: boolean;
  needsChallenge: boolean;
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const [{ data: aalData, error: aalErr }, { data: factorsData, error: factorsErr }] =
    await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

  if (aalErr) throw new Error(aalErr.message);
  if (factorsErr) throw new Error(factorsErr.message);

  const verifiedFactors = (factorsData?.totp || []).filter(
    (f: any) => f.status === 'verified'
  );

  const currentLevel = aalData?.currentLevel || 'aal1';
  const nextLevel = aalData?.nextLevel || 'aal1';
  const hasTotp = verifiedFactors.length > 0;
  const needsChallenge = hasTotp && currentLevel !== 'aal2';

  return {
    currentLevel,
    nextLevel,
    verifiedFactors,
    hasTotp,
    needsChallenge,
  };
}

export async function enrollTotp(friendlyName: string = 'InfraControl Authenticator') {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Gagal memulai pendaftaran 2FA TOTP.');
  }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function verifyTotpCode(factorId: string, code: string) {
  const cleanCode = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('Kode OTP harus berupa 6 digit angka.');
  }

  const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeErr || !challengeData) {
    throw new Error(challengeErr?.message || 'Gagal membuat challenge 2FA.');
  }

  const { data: verifyData, error: verifyErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code: cleanCode,
  });

  if (verifyErr) {
    throw new Error('Kode OTP tidak valid atau sudah kedaluwarsa. Periksa aplikasi Authenticator Anda.');
  }

  return verifyData;
}

export async function unenrollTotp(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    throw new Error(error.message);
  }
}
