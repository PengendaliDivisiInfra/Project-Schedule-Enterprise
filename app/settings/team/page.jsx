'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase'; // Sesuaikan path
import { useProject } from '../../../context/ProjectContext'; // Sesuaikan path
import { UserPlus, Trash2, ShieldCheck, Mail, Loader2, AlertTriangle } from 'lucide-react';

export default function TeamPage() {
  const { activeProjectId } = useProject();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('DCC/Logistic');
  const [isInviting, setIsInviting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // STATE UNTUK CUSTOM MODAL HAPUS
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMembers = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        id, role, user_id,
        profiles ( email, full_name )
      `)
      .eq('project_id', activeProjectId);
    
    if (!error && data) setMembers(data);
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, [activeProjectId]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setIsInviting(true);
    setErrorMsg(''); setSuccessMsg('');

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', inviteEmail)
      .maybeSingle();

    if (profileError || !profileData) {
      setErrorMsg('Email tidak ditemukan. Pastikan staf sudah login minimal 1 kali.');
      setIsInviting(false);
      return;
    }

    const { error: insertError } = await supabase.from('project_members').insert([{
      project_id: activeProjectId,
      user_id: profileData.id,
      role: inviteRole 
    }]);

    if (insertError) {
      setErrorMsg(insertError.message.includes('unique') ? 'User sudah ada di dalam proyek ini.' : insertError.message);
    } else {
      setSuccessMsg(`Berhasil mengundang ${inviteEmail} sebagai ${inviteRole}`);
      setInviteEmail('');
      fetchMembers();
    }
    setIsInviting(false);
  };

  // FUNGSI HAPUS (DIPANGGIL DARI MODAL)
  const executeRemove = async () => {
    if (!memberToDelete) return;
    setIsDeleting(true);
    await supabase.from('project_members').delete().eq('id', memberToDelete.id);
    setMemberToDelete(null);
    setIsDeleting(false);
    fetchMembers();
  };

  const formatRoleBadge = (role) => {
    const r = role.toLowerCase();
    if (r === 'pm' || r === 'project manager') return 'Project Manager';
    if (r === 'dcc' || r === 'logistic' || r === 'data entry (dd)' || r === 'dcc/logistic') return 'DCC / Logistic';
    if (r === 'qc' || r === 'quality control (qc)') return 'Quality Control';
    if (r === 'hse' || r === 'hse (k3)') return 'HSE (K3)';
    if (r === 'site_admin' || r === 'site admin') return 'Site Admin';
    return role;
  };

  if (!activeProjectId) return <div className="p-10 text-center">Pilih proyek terlebih dahulu.</div>;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-indigo-600" /> Manajemen Tim Proyek
          </h1>
          <p className="text-sm text-slate-500 mt-1">Kelola akses anggota lapangan (DCC, QC, HSE, Site Admin).</p>
        </div>

        {/* Form Undang Anggota */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Undang Anggota Baru</h2>
          {errorMsg && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-200">{errorMsg}</div>}
          {successMsg && <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm mb-4 border border-green-200">{successMsg}</div>}
          
          <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input required type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email.staf@gmail.com" className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <select 
              value={inviteRole} 
              onChange={e => setInviteRole(e.target.value)} 
              className="border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
            >
              <option value="DCC/Logistic">DCC / Logistic</option>
              <option value="Quality Control (QC)">Quality Control (QC)</option>
              <option value="HSE (K3)">HSE (K3)</option>
              <option value="Site Admin">Site Admin</option>
              <option value="Project Manager">Project Manager</option>
            </select>
            <button type="submit" disabled={isInviting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md flex items-center justify-center gap-2">
              {isInviting ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />} Undang
            </button>
          </form>
        </div>

        {/* Tabel Anggota */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-4">Nama & Email</th>
                <th className="p-4 text-center">Role Akses</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{m.profiles?.full_name || 'Tanpa Nama'}</div>
                    <div className="text-xs text-slate-500">{m.profiles?.email}</div>
                  </td>
                  <td className="p-4 text-center">
                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      {formatRoleBadge(m.role)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {/* Cegah PM menghapus dirinya sendiri, atau Owner menghapus PM utama */}
                    {m.role.toLowerCase() !== 'project manager' && m.role.toLowerCase() !== 'pm' && (
                      <button onClick={() => setMemberToDelete(m)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Keluarkan">
                        <Trash2 size={16}/>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 && <tr><td colSpan="3" className="p-8 text-center text-slate-500">Belum ada anggota tim.</td></tr>}
            </tbody>
          </table>
        </div>

      </div>

      {/* ======================================================== */}
      {/* CUSTOM MODAL HAPUS ANGGOTA (PENGGANTI CONFIRM)           */}
      {/* ======================================================== */}
      {memberToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 mb-4 text-red-600">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Keluarkan Anggota?</h3>
            </div>
            
            <p className="text-sm text-slate-600 mb-6">
              Apakah Anda yakin ingin mengeluarkan <strong>{memberToDelete.profiles?.full_name || memberToDelete.profiles?.email}</strong> dari proyek ini? 
              Anggota ini tidak akan bisa mengakses data proyek lagi.
            </p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setMemberToDelete(null)} 
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={executeRemove} 
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md transition-colors flex items-center gap-2"
              >
                {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Ya, Keluarkan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}