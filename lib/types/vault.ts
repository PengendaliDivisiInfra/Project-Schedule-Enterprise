export interface ProjectDocument {
  id: string;
  project_id: string;
  title: string;
  category: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  is_active: boolean;
  uploaded_by: string | null;
  created_at: string;
}

export interface ProjectPhoto {
  id: string;
  project_id: string;
  task_id: string | null;
  title: string;
  description: string | null;
  photo_url: string;
  file_size: number | null;
  is_active: boolean;
  uploaded_by: string | null;
  created_at: string;
}