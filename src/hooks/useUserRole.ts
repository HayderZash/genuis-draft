import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const ADMIN_EMAIL = 'hayderpailot@gmail.com';

const cacheKey = (uid: string) => `user_role_cache_${uid}`;

export const isAdminCached = (uid: string | undefined, email?: string | null): boolean => {
  if (!uid) return false;
  if (email && email.toLowerCase() === ADMIN_EMAIL) return true;
  try {
    return localStorage.getItem(cacheKey(uid)) === 'admin';
  } catch {
    return false;
  }
};

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(() => {
    if (!user) return null;
    if (user.email?.toLowerCase() === ADMIN_EMAIL) return 'admin';
    try { return localStorage.getItem(cacheKey(user.id)); } catch { return null; }
  });
  const [isRoleLoading, setIsRoleLoading] = useState(!role);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setIsRoleLoading(false);
      return;
    }

    // Hard-coded admin email shortcut
    if (user.email?.toLowerCase() === ADMIN_EMAIL) {
      setRole('admin');
      setIsRoleLoading(false);
      try { localStorage.setItem(cacheKey(user.id), 'admin'); } catch {}
      return;
    }

    const fetchRole = async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .abortSignal(ctrl.signal);
        clearTimeout(t);
        const roles = (data || []).map((r: any) => r.role);
        const r = roles.includes('admin') ? 'admin' : 'user';
        setRole(r);
        try { localStorage.setItem(cacheKey(user.id), r); } catch {}
      } catch {
        // keep cached role
      } finally {
        setIsRoleLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  return { role, isRoleLoading, isAdmin: role === 'admin' };
};
