// lib/services/vault.service.ts
import { supabase } from '@/lib/supabase';
import { ProjectDocument, ProjectPhoto } from '@/lib/types/vault';

// ==========================================
// UPLOAD FUNCTIONS
// ==========================================

export async function uploadDocument(
  file: File, 
  projectId: string, 
  title: string, 
  category: string, 
  userId: string
) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${projectId}/${fileName}`;

  // 1. Upload fisik file ke Storage (Private Bucket)
  const { error: uploadError } = await supabase.storage
    .from('project-vault')
    .upload(filePath, file);

  if (uploadError) throw new Error(uploadError.message);

  // 2. Insert metadata ke Database (Simpan PATH, bukan URL penuh)
  const { data, error } = await supabase.from('project_documents').insert({
    project_id: projectId,
    title,
    category,
    file_url: filePath, // Menyimpan path relatif, misal: "123-uuid/nama_file.pdf"
    file_name: file.name,
    file_size: file.size,
    file_type: file.type,
    uploaded_by: userId,
  }).select().single();

  if (error) throw new Error(error.message);
  return data as ProjectDocument;
}

export async function uploadPhoto(
  file: File,
  projectId: string,
  title: string,
  taskId: string | null,
  description: string,
  userId: string
) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${projectId}/${fileName}`;

  // 1. Upload fisik file ke Storage (Private Bucket)
  const { error: uploadError } = await supabase.storage
    .from('project-vault')
    .upload(filePath, file);

  if (uploadError) throw new Error(uploadError.message);

  // 2. Insert metadata ke Database (Simpan PATH, bukan URL penuh)
  const { data, error } = await supabase.from('project_photos').insert({
    project_id: projectId,
    task_id: taskId,
    title,
    description,
    photo_url: filePath, // Menyimpan path relatif
    file_size: file.size,
    uploaded_by: userId,
  }).select().single();

  if (error) throw new Error(error.message);
  return data as ProjectPhoto;
}

// ==========================================
// FETCH FUNCTIONS (Dengan Signed URL)
// ==========================================

export async function getDocuments(projectId: string) {
  // 1. Ambil data dari DB
  const { data, error } = await supabase
    .from('project_documents')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  if (error) throw new Error(error.message);

  // 2. Ubah path menjadi Signed URL yang berlaku 1 jam (3600 detik)
  const docsWithUrls = await Promise.all(data.map(async (doc) => {
    const { data: signedData } = await supabase.storage
      .from('project-vault')
      .createSignedUrl(doc.file_url, 3600);
      
    return { 
      ...doc, 
      // Jika signedData gagal, fallback ke string kosong agar UI tidak crash
      file_url: signedData?.signedUrl || '' 
    };
  }));

  return docsWithUrls as ProjectDocument[];
}

export async function getPhotos(projectId: string) {
  // 1. Ambil data dari DB
  const { data, error } = await supabase
    .from('project_photos')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  if (error) throw new Error(error.message);

  // 2. Ubah path menjadi Signed URL yang berlaku 1 jam (3600 detik)
  const photosWithUrls = await Promise.all(data.map(async (photo) => {
    const { data: signedData } = await supabase.storage
      .from('project-vault')
      .createSignedUrl(photo.photo_url, 3600);
      
    return { 
      ...photo, 
      photo_url: signedData?.signedUrl || '' 
    };
  }));

  return photosWithUrls as ProjectPhoto[];
}

// ==========================================
// DELETE FUNCTIONS (Soft Delete)
// ==========================================

export async function softDeleteDocument(id: string) {
  const { error } = await supabase
    .from('project_documents')
    .update({ is_active: false })
    .eq('id', id);
    
  if (error) throw new Error(error.message);
}

export async function softDeletePhoto(id: string) {
  const { error } = await supabase
    .from('project_photos')
    .update({ is_active: false })
    .eq('id', id);
    
  if (error) throw new Error(error.message);
}