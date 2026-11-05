'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useProject } from '../../../context/ProjectContext';
import { UserPlus, Trash2, ShieldCheck, Mail, Loader2 } from 'lucide-react';

export default function TeamPage() {
  const { activeProjectId } = useProject();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  
  // DEFAULT ROLE: Ubah dari 'dd' menjadi 'DCC/Logistic'
  const [inviteRole, setInviteRole] = useState('DCC/Logistic');
  
  const [isInviting, setIsInviting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchMembers = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    // Mengambil data keanggotaan beserta profil user (email & nama)
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

    // 1. Cari user berdasarkan email di tabel profiles
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

    // 2. Masukkan ke project_members
    const { error: insertError } = await supabase.from('project_members').insert([{
      project_id: activeProjectId,
      user_id: profileData.id,
      role: inviteRole // Menyimpan string utuh: 'DCC/Logistic', 'Project Manager', dll.
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

  const handleRemove = async (memberId) => {
    if (!confirm('Yakin ingin mengeluarkan anggota ini dari proyek?')) return;
    await supabase.from('project_members').delete().eq('id', memberId);
    fetchMembers();
  };

  // Helper untuk format tampilan badge role
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
              {/* UPDATE: Value dan Text disesuaikan dengan standar permissions.ts */}
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
                      <button onClick={() => handleRemove(m.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Keluarkan"><Trash2 size={16}/></button>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 && <tr><td colSpan="3" className="p-8 text-center text-slate-500">Belum ada anggota tim.</td></tr>}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}