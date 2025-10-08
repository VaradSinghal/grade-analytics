import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSupabaseAuth() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!isMounted) return;
        setUserEmail(data.user?.email ?? null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          hd: 'srmist.edu.in'
        },
        redirectTo: window.location.origin
      }
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { loading, userEmail, signInWithGoogle, signOut };
}


