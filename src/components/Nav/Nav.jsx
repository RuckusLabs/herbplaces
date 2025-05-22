import { Link } from 'react-router-dom';
import styles from "./nav.module.scss";
import classNames from 'classnames';
import PropTypes from 'prop-types';
import Logo from "/src/assets/little-herb-places-logo.svg?react";
import InstagramIcon from "/src/assets/instagram-icon.svg?react";
import TikTok from "/src/assets/tiktok-icon.svg?react";

export default function Nav({ variant, className }) {
  return (
    <nav className={classNames(
      styles.nav,
      `${styles.nav}--glass`,
      styles[`nav--${variant}`],
      className
    )}>
      <Link to="/" className={styles.logo}>
        <Logo />
      </Link>
      <div className={styles.navLinks}>
        <Link to="/map">Explore</Link>
        {/* <Link to="/shop">Shop</Link> */}
        {/* <Link to="/about">About</Link> */}
        <Link to="/the-little-garden">The Little Garden</Link>
        <Link to="https://www.instagram.com/littleherbplaces/"><InstagramIcon /></Link>
        <Link to="https://www.tiktok.com/@littleherbplaces"><TikTok className={styles.tiktok} /></Link>
      </div>
    </nav>
  );
}

Nav.propTypes = {
  variant: PropTypes.string.isRequired,
  className: PropTypes.string
};