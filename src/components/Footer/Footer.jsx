import { Link } from 'react-router-dom';
import Logo from '../../assets/little-herb-places-logo.svg?react';
import Instagram from '../../assets/instagram-icon.svg?react';
import TikTok from '../../assets/tiktok-icon.svg?react';
import styles from './footer.module.scss';

export default function Footer() {
  return <footer className={styles.footer}>
    <div className={styles.top}>
      <div className={styles.intro}><Link to="/" className={styles.brand} aria-label="Little Herb Places Home"><Logo aria-hidden="true" focusable="false" /></Link><p>Rooted in nature.<br />Connected through community.</p></div>
      <div className={styles.column}><h3>Wander a Little</h3><Link to="/map">Explore Places</Link><Link to="/browse">Browse by City</Link><Link to="/discover">Offerings & Events</Link><Link to="/favorites">Your Saved Places</Link><Link to="/about">Our Story</Link></div>
      <div className={styles.column}><h3>Put Down Roots</h3><Link to="/the-little-garden">For Business Owners</Link><Link to="/the-little-garden/bloom">Bloom Listing Tools</Link><Link to="/the-little-garden/thrive">Thrive Coming Soon</Link><Link to="/request-place">Request a Listing</Link><Link to="/register">Join the Community</Link><a href="mailto:help@littleherbplaces.com">Get in Touch</a></div>
      <div className={styles.column}><h3>Grow With Us</h3><a href="https://www.instagram.com/littleherbplaces/" className={styles.social}><Instagram aria-hidden="true" /> Instagram</a><a href="https://www.tiktok.com/@littleherbplaces" className={styles.social}><TikTok aria-hidden="true" /> TikTok</a></div>
    </div>
    <div className={styles.bottom}><span>© 2024 - {new Date().getFullYear()} Little Herb Places</span><span>Made with care. Inspired by plants.</span><Link to="/help">Help & Billing</Link><Link to="/privacy">Privacy</Link><Link to="/membership-terms">Membership Terms</Link></div>
  </footer>;
}
