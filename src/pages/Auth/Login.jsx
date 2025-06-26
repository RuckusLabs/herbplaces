import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from "react-helmet";
import supabase from '/src/utilities/supabase';
import { useFavorites } from '/src/hooks/useFavorites';
import { useAuth } from '/src/contexts/AuthContext';
import styles from './auth.module.scss';

export default function Login() {
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
        // If no guest favorites, still redirect after login
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      setNeedsSync(true);
    } catch (error) {
      setMessage(error.message || 'An error occurred during authentication');
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
        <title>Sign In | Little Herb Places</title>
      </Helmet>
      <section className={styles.authSection}>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.content}>
              <h4>Welcome Back</h4>
              <p>Please enter your credentials.</p>
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
                  <div className={styles.messageError}>{message}</div>
                )}
                <button
                  className={styles.button}
                  type="submit"
                  disabled={loading || !isFormValid}
                >
                  {loading ? 'Please wait...' : 'Sign In'}
                </button>
              </form>
              <div className="text-align-center" style={{marginTop: 16}}>
                <Link to="/register">Don't have an account? Register.</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
