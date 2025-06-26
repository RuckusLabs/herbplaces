import { createContext, useContext, useEffect, useState } from 'react';
import supabase from '/src/utilities/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Check active sessions
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Session check error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
      }
    });

    // Cleanup
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    user,
    loading,
    signIn: (options) => supabase.auth.signInWithPassword({
      ...options,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    }),
    signUp: (options) => supabase.auth.signUp({
      ...options,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    }),
    signOut: () => supabase.auth.signOut(),
    checkEmail: async (email) => {
      try {
        const { data, error } = await supabase.rpc('check_if_email_exists', {
          email_input: email
        });
        
        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error checking email:', error);
        return false;
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);