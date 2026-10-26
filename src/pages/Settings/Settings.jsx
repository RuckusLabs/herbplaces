import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import { useManagement } from '../../contexts/ManagementContext';
import Icon from '../../components/Icons/Icon';
import styles from './settings.module.scss';

function AccountSettings({ user }) {
  const { updateProfile, changeEmail } = useAuth();
  const { hasOwnerActivity } = useManagement();
  const [name, setName] = useState(user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name || '');
  const [email, setEmail] = useState(user.new_email || user.email || '');
  const [view, setView] = useState(user.user_metadata?.directory_view === 'map' ? 'map' : 'list');
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState({});
  const save = async (section, action, success) => {
    setBusy(section); setFeedback(previous => ({ ...previous, [section]: null }));
    try {
      const result = await action();
      if (result.error) throw result.error;
      setFeedback(previous => ({ ...previous, [section]: { text: success(result.data?.user), error: false } }));
    } catch (error) { setFeedback(previous => ({ ...previous, [section]: { text: error.message || 'Unable to save. Please try again.', error: true } })); }
    finally { setBusy(''); }
  };
  const message = section => feedback[section] && <p className={feedback[section].error ? styles.error : styles.success} role={feedback[section].error ? 'alert' : 'status'}>{feedback[section].text}</p>;
  return <main id="main-content" className={styles.page}>
    <Helmet><title>Account Settings | Little Herb Places</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <header className={styles.header}><Icon name="leaf" size={42} /><h1>Your Account.</h1><p>A few details to make this little corner yours.</p></header>
    <div className={styles.layout}><nav className={styles.sections} aria-label="Account settings sections"><a href="#profile">Your profile</a><a href="#email">Email address</a><a href="#preferences">Browsing preferences</a><a href="#security">Sign-in & security</a></nav><div className={styles.cards}>
      <section id="profile" className={styles.card}><p className={styles.eyebrow}>A little introduction</p><h2>Your profile</h2><p>Your name appears in your account menu. Your business listing has its own name and details.</p>
        <form onSubmit={event => { event.preventDefault(); if (name.trim()) void save('profile', () => updateProfile({ full_name: name.trim() }), () => 'Your name has been saved.'); }}><label htmlFor="settings-name">Your name</label><input id="settings-name" autoComplete="name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={!!busy} />{message('profile')}<button className="button" disabled={!!busy || !name.trim() || name.trim() === (user.user_metadata?.full_name || '')}>{busy === 'profile' ? 'Saving…' : 'Save Name'}</button></form>
      </section>
      <section id="email" className={styles.card}><p className={styles.eyebrow}>Where we can reach you</p><h2>Email address</h2><p>Your current sign-in email is <strong>{user.email}</strong>.</p>{user.new_email && user.new_email !== user.email && <p className={styles.pending} role="status">Awaiting confirmation: {user.new_email}. Your current address stays in use until the change is confirmed.</p>}
        <form onSubmit={event => { event.preventDefault(); void save('email', () => changeEmail(email.trim()), updated => updated?.email === email.trim() ? 'Your email address has been updated.' : 'Check your inbox to confirm the change. You may need to approve it from both your current and new email addresses. Until then, sign in with your current address.'); }}><label htmlFor="settings-email">New email address</label><input id="settings-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={!!busy} /><p className={styles.hint}>We’ll send any required confirmation emails before changing your sign-in address.</p>{message('email')}<button className="button" disabled={!!busy || !email.trim() || email.trim() === user.email}>{busy === 'email' ? 'Sending…' : 'Update Email'}</button></form>
      </section>
      <section id="preferences" className={styles.card}><p className={styles.eyebrow}>Explore your way</p><h2>Browsing preferences</h2><p>Choose how Explore Places opens when a link doesn’t specify a view. This preference follows your account across devices.</p>
        <form onSubmit={event => { event.preventDefault(); void save('preferences', () => updateProfile({ directory_view: view }), () => 'Your browsing preference has been saved.'); }}><fieldset disabled={!!busy}><legend>Default directory view</legend><div className={styles.viewChoices}>{[['list', 'grid', 'List', 'Browse photos and place details.'], ['map', 'map', 'Map', 'See where places are located.']].map(([value, icon, title, detail]) => <label key={value} className={view === value ? styles.selected : ''}><input type="radio" name="directory-view" value={value} checked={view === value} onChange={() => setView(value)} /><Icon name={icon} size={24} /><span><strong>{title}</strong><small>{detail}</small></span></label>)}</div></fieldset>{message('preferences')}<button className="button" disabled={!!busy || view === (user.user_metadata?.directory_view === 'map' ? 'map' : 'list')}>{busy === 'preferences' ? 'Saving…' : 'Save Preferences'}</button></form>
      </section>
      <section id="security" className={styles.card}><p className={styles.eyebrow}>Keep things in your hands</p><h2>Sign-in & security</h2><p>Need to change your password? We’ll email a secure link so you can choose a new one.</p><Link className={styles.textLink} to="/auth/forgot-password?next=%2Fsettings">Reset Your Password <Icon name="arrow" size={16} /></Link><p className={styles.hint}>Account changes keep your saved places and approved listing access connected to you.</p></section>
      {hasOwnerActivity && <aside className={styles.ownerNote}><Icon name="shop" size={32} /><div><h2>Looking after a place?</h2><p>Manage your listings, claims, and billing in <Link to="/my-places">My Places</Link>.</p></div></aside>}
    </div></div>
  </main>;
}
AccountSettings.propTypes = { user: PropTypes.object.isRequired };

export default function Settings() {
  const { user, loading } = useAuth();
  if (loading) return <main id="main-content" className={styles.page}><p role="status">Loading your account…</p></main>;
  if (!user) return <Navigate to="/login?next=%2Fsettings" replace />;
  return <AccountSettings key={user.id} user={user} />;
}
