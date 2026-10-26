import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import styles from './nav.module.scss';
import Logo from '../../assets/little-herb-places-logo.svg?react';
import Icon from '../Icons/Icon';
import { useAuth } from '../../contexts/AuthContext';
import { useManagement } from '../../contexts/ManagementContext';

export default function Nav({ variant, className = '', minimal = false }) {
  const { user, signOut } = useAuth();
  const { is_admin: isAdmin, hasOwnerActivity } = useManagement();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const account = useRef(null);
  const accountButton = useRef(null);
  const accountId = useId();
  const accountName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Your account';
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); setAccountOpen(false); setLogoutError(''); }, [pathname, user?.id]);
  useEffect(() => {
    const escape = event => {
      if (event.key !== 'Escape') return;
      if (accountOpen) { setAccountOpen(false); accountButton.current?.focus(); }
      else setOpen(false);
    };
    const outside = event => { if (!account.current?.contains(event.target)) setAccountOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); };
  }, [accountOpen]);
  const logout = async () => {
    setSigningOut(true); setLogoutError('');
    try {
      const result = await signOut();
      if (result?.error) throw result.error;
      setAccountOpen(false); setOpen(false);
    } catch { setLogoutError('Unable to sign out. Please try again.'); }
    finally { setSigningOut(false); }
  };
  if (minimal) return <><a className="skip-link" href="#main-content">Skip to content</a><nav className={styles.nav} aria-label="Setup navigation"><Link to="/" className={styles.brand} aria-label="Little Herb Places home"><Logo aria-hidden="true" focusable="false" /></Link><Link className={styles.minimalHelp} to="/help">Need a hand?</Link></nav></>;
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <nav className={`${styles.nav} ${pathname === '/' ? styles.home : ''} ${variant === 'bleed' ? styles.bleed : ''} ${className}`} aria-label="Main navigation">
      <Link to="/" className={styles.brand} aria-label="Little Herb Places home"><Logo aria-hidden="true" focusable="false" /></Link>
      <button className={styles.menuButton} aria-expanded={open} aria-controls="main-navigation" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(value => !value)}><Icon name={open ? 'close' : 'menu'} size={23} /></button>
      <div id="main-navigation" className={`${styles.links} ${open ? styles.open : ''}`}>
        <NavLink to="/map">Explore Places</NavLink>
        <NavLink to="/about">Our Story</NavLink>
        <NavLink to="/the-little-garden">For Business Owners</NavLink>
        {user && hasOwnerActivity && <NavLink to="/my-places">My Places</NavLink>}
        <NavLink className={styles.saved} to="/favorites"><Icon name="heart" size={30} /><span>Saved Places</span></NavLink>
        {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        {user ? <div className={styles.account} ref={account} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false); }}>
          <button ref={accountButton} type="button" className={styles.accountToggle} aria-expanded={accountOpen} aria-controls={accountId} onClick={() => setAccountOpen(value => !value)}><span className={styles.avatar} aria-hidden="true">{accountName.slice(0, 1).toUpperCase()}</span><span className={styles.accountName}>{accountName}</span><svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          {accountOpen && <div id={accountId} className={styles.accountDropdown}><p>Signed in as<strong>{accountName}</strong><span>{user.email}</span></p><Link className={styles.accountSettings} to="/settings">Account Settings<Icon name="arrow" size={16} /></Link><button type="button" onClick={logout} disabled={signingOut}>{signingOut ? 'Signing Out…' : 'Sign Out'}<Icon name="arrow" size={16} /></button>{logoutError && <p role="alert" className={styles.logoutError}>{logoutError}</p>}</div>}
        </div> : <Link className={`button ${styles.join}`} to="/register">Join the Community <Icon name="arrow" size={15} /></Link>}
      </div>
    </nav>
  </>;
}
Nav.propTypes = { variant: PropTypes.string.isRequired, className: PropTypes.string, minimal: PropTypes.bool };
