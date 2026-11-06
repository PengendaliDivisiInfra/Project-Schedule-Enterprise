import { z } from 'zod';

export const createContractSchema = z.object({
  project_id: z.string().uuid(),
  contract_number: z.string().min(1, 'Nomor kontrak wajib diisi'),
  contract_name: z.string().optional(),
  contract_value: z.number().min(0, 'Nilai kontrak tidak boleh negatif'),
  retention_pct: z.number().min(0).max(100),
  ppn_pct: z.number().min(0).max(100),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export const createTerminSchema = z.object({
  project_id: z.string().uuid(),
  contract_id: z.string().uuid(),
  termin_no: z.number().int().min(1),
  name: z.string().min(1, 'Nama termin wajib diisi'),
  planned_progress_pct: z.number().min(0).max(100),
  previous_progress_pct: z.number().min(0).max(100),
  actual_progress_pct: z.number().min(0).max(100),
  gross_amount: z.number().min(0),
  retention_pct: z.number().min(0).max(100),
  notes: z.string().optional(),
});

export const issueInvoiceSchema = z.object({
  termin_id: z.string().uuid(),
  invoice_number: z.string().min(1, 'Nomor invoice wajib diisi'),
  invoice_date: z.string().min(1, 'Tanggal invoice wajib diisi'),
  due_date: z.string().optional(),
  ppn_pct: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export const recordReceiptSchema = z.object({
  invoice_id: z.string().uuid(),
  receipt_number: z.string().min(1, 'Nomor receipt wajib diisi'),
  receipt_date: z.string().min(1, 'Tanggal terima wajib diisi'),
  amount: z.number().positive('Jumlah harus lebih dari 0'),
  bank_name: z.string().optional(),
  bank_account: z.string().optional(),
  reference_no: z.string().optional(),
  proof_url: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
});

export const voidReceiptSchema = z.object({
  receipt_id: z.string().uuid(),
  reason: z.string().min(5, 'Alasan pembatalan wajib diisi minimal 5 karakter'),
});

export const releaseRetentionSchema = z.object({
  contract_id: z.string().uuid(),
  release_no: z.number().int().min(1),
  release_date: z.string().min(1),
  amount: z.number().positive(),
  receipt_number: z.string().min(1),
  bank_name: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type CreateTerminInput = z.infer<typeof createTerminSchema>;
export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;
export type RecordReceiptInput = z.infer<typeof recordReceiptSchema>;
export type VoidReceiptInput = z.infer<typeof voidReceiptSchema>;
export type ReleaseRetentionInput = z.infer<typeof releaseRetentionSchema>;