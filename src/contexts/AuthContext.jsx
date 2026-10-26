import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import supabase from '/src/utilities/supabase';
import PropTypes from 'prop-types';
import { getSafeReturnPath } from '../utilities/authNavigation';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const refreshUser = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) setUser(data.user);
  }, []);

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
    refreshUser,
    loading: loading || creatingAccount,
    signIn: options => supabase ? supabase.auth.signInWithPassword(options) : Promise.resolve({ error: new Error('Sign in is temporarily unavailable.') }),
    signUp: async ({ email, password, next }) => {
      if (!supabase) return { error: new Error('Registration is temporarily unavailable.') };
      // Favorites reference auth.users directly; no separate profile row is required.
      setCreatingAccount(true);
      try {
        return await supabase.auth.signUp({ email, password, options: { data: { email }, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeReturnPath(next, '/favorites'))}` } });
      } finally { setCreatingAccount(false); }
    },
    sendEmailCode: ({ email, registering, next }) => supabase ? supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: registering, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeReturnPath(next))}` } }) : Promise.resolve({ error: new Error('Email sign-in is temporarily unavailable.') }),
    verifyEmailCode: async ({ email, token }) => {
      if (!supabase) return { error: new Error('Email sign-in is temporarily unavailable.') };
      setCreatingAccount(true);
      try {
        return await supabase.auth.verifyOtp({ email, token, type: 'email' });
      } finally { setCreatingAccount(false); }
    },
    updateProfile: data => supabase ? supabase.auth.updateUser({ data }) : Promise.resolve({ error: new Error('Account settings are temporarily unavailable.') }),
    changeEmail: email => supabase ? supabase.auth.updateUser({ email }, { emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fsettings` }) : Promise.resolve({ error: new Error('Account settings are temporarily unavailable.') }),
    requestPasswordReset: (email, next) => supabase ? supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset-password?next=${encodeURIComponent(getSafeReturnPath(next, '/favorites'))}` }) : Promise.resolve({ error: new Error('Account recovery is temporarily unavailable.') }),
    updatePassword: password => supabase ? supabase.auth.updateUser({ password }) : Promise.resolve({ error: new Error('Account recovery is temporarily unavailable.') }),
    resendConfirmation: (email, next) => supabase ? supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeReturnPath(next, '/favorites'))}` } }) : Promise.resolve({ error: new Error('Email confirmation is temporarily unavailable.') }),
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
