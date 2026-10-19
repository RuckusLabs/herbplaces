import { createContext, useContext, useEffect, useState } from 'react';
import supabase from '/src/utilities/supabase';
import PropTypes from 'prop-types';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
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
        setLoading(false);
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
    loading: loading || creatingAccount,
    signIn: options => supabase ? supabase.auth.signInWithPassword(options) : Promise.resolve({ error: new Error('Sign in is temporarily unavailable.') }),
    signUp: async ({ email, password }) => {
      if (!supabase) return { error: new Error('Registration is temporarily unavailable.') };
      // Wait for profile setup before favorites begin merging into a new account.
      setCreatingAccount(true);
      try {
        const result = await supabase.auth.signUp({ email, password, options: { data: { email }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (!result.error && result.data.user && result.data.session) {
          const { error } = await supabase.from('profiles').upsert({ id: result.data.user.id, email: result.data.user.email || email, created_at: new Date().toISOString() }, { onConflict: 'id', ignoreDuplicates: true });
          if (error) console.warn('Profile creation could not be confirmed:', error.message);
        }
        return result;
      } finally { setCreatingAccount(false); }
    },
    signOut: () => supabase?.auth.signOut(),
    checkEmail: async (email) => {
      try {
        if (!supabase) return false;
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

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export const useAuth = () => useContext(AuthContext);
