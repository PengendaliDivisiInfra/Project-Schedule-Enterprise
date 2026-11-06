// ============================================================
// Types: Modul Termin / Progress Klien (Cash In)
// ============================================================

export type TerminStatus =
  | 'Draft' | 'Submitted' | 'Approved' | 'Invoiced'
  | 'Partially Paid' | 'Paid' | 'Closed' | 'Void';

export type InvoiceStatus =
  | 'Draft' | 'Issued' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Void';

export type ReceiptType = 'DP' | 'TERMIN' | 'RETENSI' | 'LAINNYA';
export type ReceiptApproval = 'Approved' | 'Pending' | 'Rejected';
export type ReleaseStatus = 'Draft' | 'Submitted' | 'Approved' | 'Paid' | 'Void';
export type ContractStatus = 'Draft' | 'Active' | 'Closed' | 'Void';
export type CashFlowType = 'Income' | 'Expense';

export interface ClientContract {
  id: string;
  project_id: string;
  contract_number: string;
  contract_name: string | null;
  contract_value: number;
  retention_pct: number;
  ppn_pct: number;
  start_date: string | null;
  end_date: string | null;
  status: ContractStatus;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTermin {
  id: string;
  project_id: string;
  contract_id: string;
  termin_no: number;
  name: string;
  planned_progress_pct: number;
  previous_progress_pct: number;
  actual_progress_pct: number;
  gross_amount: number;
  retention_pct: number;
  retention_amount: number;
  net_amount: number;
  status: TerminStatus;
  bapp_number: string | null;
  bapp_date: string | null;
  bapp_url: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientInvoice {
  id: string;
  project_id: string;
  termin_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  dpp_amount: number;
  ppn_pct: number;
  ppn_amount: number;
  retention_pct: number;
  retention_amount: number;
  total_invoice: number;
  net_payable_amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientInvoiceSummary extends ClientInvoice {
  outstanding: number;
}

export interface ClientReceipt {
  id: string;
  project_id: string;
  invoice_id: string | null;
  retention_release_id: string | null;
  receipt_type: ReceiptType;
  receipt_number: string;
  receipt_date: string;
  amount: number;
  bank_name: string | null;
  bank_account: string | null;
  reference_no: string | null;
  proof_url: string | null;
  approval_status: ReceiptApproval;
  cash_flow_id: string | null;
  reversal_of_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RetentionRelease {
  id: string;
  project_id: string;
  contract_id: string;
  release_no: number;
  release_date: string | null;
  amount: number;
  status: ReleaseStatus;
  approved_by: string | null;
  approved_at: string | null;
  cash_flow_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============ INPUTS ============

export interface CreateContractInput {
  project_id: string;
  contract_number: string;
  contract_name?: string;
  contract_value: number;
  retention_pct: number;
  ppn_pct: number;
  start_date?: string;
  end_date?: string;
}

export interface CreateTerminInput {
  project_id: string;
  contract_id: string;
  termin_no: number;
  name: string;
  planned_progress_pct: number;
  previous_progress_pct: number;
  actual_progress_pct: number;
  gross_amount: number;
  retention_pct: number;
  notes?: string;
}

export interface IssueInvoiceInput {
  termin_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  ppn_pct?: number;
  notes?: string;
}

export interface RecordReceiptInput {
  invoice_id: string;
  receipt_number: string;
  receipt_date: string;
  amount: number;
  bank_name?: string;
  bank_account?: string;
  reference_no?: string;
  proof_url?: string;
  notes?: string;
}

export interface VoidReceiptInput {
  receipt_id: string;
  reason: string;
}

export interface ReleaseRetentionInput {
  contract_id: string;
  release_no: number;
  release_date: string;
  amount: number;
  receipt_number: string;
  bank_name?: string;
  notes?: string;
}

// ============ FORMULAS (single source of truth) ============

export function calcRetention(gross: number, retentionPct: number): number {
  return Number(((gross * retentionPct) / 100).toFixed(2));
}

export function calcPpn(dpp: number, ppnPct: number): number {
  return Number(((dpp * ppnPct) / 100).toFixed(2));
}

export function calcTotalInvoice(dpp: number, ppn: number): number {
  return Number((dpp + ppn).toFixed(2));
}

export function calcNetPayable(totalInvoice: number, retention: number): number {
  return Number((totalInvoice - retention).toFixed(2));
}

export function calcOutstanding(netPayable: number, paid: number): number {
  return Number((netPayable - paid).toFixed(2));
}