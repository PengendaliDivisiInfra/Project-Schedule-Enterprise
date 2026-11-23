export const saveToCache = (key, data) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`infra_cache_${key}`, JSON.stringify(data));
    } catch (e) {
      console.error('Gagal menyimpan cache', e);
    }
  }
};

export const getFromCache = (key) => {
  if (typeof window !== 'undefined') {
    try {
      const data = localStorage.getItem(`infra_cache_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }
  return null;
};

export const invalidateCache = (key) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`infra_cache_${key}`);
    } catch (e) {
      console.error('Gagal menghapus cache', e);
    }
  }
};