import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from "react-helmet";
import supabase from '/src/utilities/supabase';
import { useFavorites } from '/src/hooks/useFavorites';
import { useAuth } from '/src/contexts/AuthContext';
import styles from './auth.module.scss';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [needsSync, setNeedsSync] = useState(false);
  const { user } = useAuth();
  const { getGuestFavorites, clearGuestFavorites, toggleFavorite } = useFavorites();
  const navigate = useNavigate();

  // Sync guest favorites after user is set
  useEffect(() => {
    const doSync = async () => {
      const guestFavs = getGuestFavorites();
      if (user && guestFavs.length > 0 && needsSync) {
        for (const id of guestFavs) {
          await toggleFavorite(id);
        }
        clearGuestFavorites();
        setNeedsSync(false);
        navigate('/map');
      } else if (user && needsSync) {
        setNeedsSync(false);
        navigate('/map');
      }
    };
    doSync();
    // eslint-disable-next-line
  }, [user, needsSync]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { email },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
      // Handle profile creation
      if (data.user) {
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
              id: data.user.id,
              email: data.user.email || email,
              created_at: new Date().toISOString()
            }]);
          if (profileError) {
            console.error('Profile creation error:', profileError);
          }
        } catch (profileErr) {
          console.error('Profile creation failed:', profileErr);
        }
      }
      if (data.session) {
        setNeedsSync(true);
      }
      if (data.user && !data.session) {
        setMessage('Check your email to confirm your account!');
      } else if (data.session) {
        navigate('/map');
      }
    } catch (error) {
      setMessage(error.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePassword = (password) => password.length >= 6;
  const isFormValid = validateEmail(email) && validatePassword(password);

  return (
    <>
      <Helmet>
        <title>Register | Little Herb Places</title>
      </Helmet>
      <section className={styles.authSection}>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.content}>
              <h4>Create Account</h4>
              <p>Please fill in the details to create an account.</p>
              <form onSubmit={handleSubmit} className={styles.form}>
                <label htmlFor="email" className={styles.label}>Email</label>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={
                    email === '' || validateEmail(email)
                      ? styles.input
                      : `${styles.input} ${styles.inputError}`
                  }
                />
                <label htmlFor="password" className={styles.label}>Password</label>
                <input
                  type="password"
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={
                    password === '' || validatePassword(password)
                      ? styles.input
                      : `${styles.input} ${styles.inputError}`
                  }
                />
                {message && (
                  <div className={message.includes('error') ? styles.messageError : styles.messageSuccess}>
                    {message}
                  </div>
                )}
                <button
                  className={styles.button}
                  type="submit"
                  disabled={loading || !isFormValid}
                >
                  {loading ? 'Please wait...' : 'Register'}
                </button>
              </form>
              <div className="text-align-center" style={{marginTop: 16}}>
                <Link to="/login">Already have an account? Sign in.</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
