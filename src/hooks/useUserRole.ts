import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setIsRoleLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roles = (data || []).map((r: any) => r.role);
      setRole(roles.includes('admin') ? 'admin' : 'user');
      setIsRoleLoading(false);
    };

    fetchRole();
  }, [user]);

  return { role, isRoleLoading, isAdmin: role === 'admin' };
};
