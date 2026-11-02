export function calculateEVM(data) {
  const today = new Date();
  today.setHours(0,0,0,0);
  
  return data.map(t => {
    const vol = Number(t.volume) || 0;
    const dur = Number(t.duration) || 1;
    const progPct = Number(t.progress_percent) || 0;
    const startDate = t.start_date ? new Date(t.start_date) : null;
    const endDate = t.end_date ? new Date(t.end_date) : null;
    
    let smartTargetPct = 0;
    let sisaHari = dur;

    if (t.summary === 'No' && startDate && endDate) {
      if (today >= endDate) {
        smartTargetPct = 100;
        sisaHari = 0;
      } else if (today > startDate) {
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 1;
        const elapsedDays = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
        smartTargetPct = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
        sisaHari = Math.max(0, totalDays - elapsedDays);
      }
    }

    const actualVol = vol * (progPct / 100);
    const sisaVol = vol - actualVol;
    const varianPct = progPct - smartTargetPct;
    const butuhTHr = sisaHari > 0 ? (sisaVol / sisaHari) : 0;

    return { 
      ...t, 
      smart_target: smartTargetPct, 
      sisa_hari_efektif: sisaHari, 
      actual_vol: actualVol, 
      sisa_vol: sisaVol, 
      varian_pct: varianPct, 
      butuh_t_hr: butuhTHr 
    };
  });
}