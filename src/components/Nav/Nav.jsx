import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import styles from './nav.module.scss';
import Logo from '../../assets/little-herb-places-logo.svg?react';
import Icon from '../Icons/Icon';
import { useAuth } from '../../contexts/AuthContext';
import { useManagement } from '../../contexts/ManagementContext';

export default function Nav({ variant, className = '', minimal = false }) {
  const { user, signOut } = useAuth();
  const { is_admin: isAdmin } = useManagement();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);
  const logout = async () => {
    const result = await signOut();
    if (result?.error) setLogoutError('Unable to sign out. Please try again.');
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
        {user && <NavLink to="/favorites#my-places">My Places</NavLink>}
        <NavLink className={styles.saved} to="/favorites"><Icon name="heart" size={30} /><span>Saved Places</span></NavLink>
        {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        {user ? <button onClick={logout} className={`button ${styles.join}`}>Sign Out</button> : <Link className={`button ${styles.join}`} to="/register">Join the Community <Icon name="arrow" size={15} /></Link>}
        {logoutError && <p role="alert">{logoutError}</p>}
      </div>
    </nav>
  </>;
}
Nav.propTypes = { variant: PropTypes.string.isRequired, className: PropTypes.string, minimal: PropTypes.bool };
