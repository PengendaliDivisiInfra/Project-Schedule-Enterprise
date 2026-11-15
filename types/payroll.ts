export type EmployeeType = 'Office' | 'Project';
export type EmploymentStatus = 'Active' | 'Resigned' | 'Transferred';

export interface Employee {
  id: string;
  project_id: string;
  name: string;
  role_title: string;
  employee_type: EmployeeType;
  is_all_in: boolean; // <-- WAJIB DITAMBAHKAN
  base_salary: number;
  tunjangan: number;
  daily_rate: number;
  overtime_rate: number;
  meal_allowance: number;
  bank_name: string | null;
  bank_account: string | null;
  is_active: boolean;
  employment_status: EmploymentStatus;
  resignation_date: string | null;
  nik: string | null;
  work_location: string | null;
  created_at: string;
}