import { Link } from 'react-router-dom';
import Logo from "/assets/little-herb-places-logo.svg";
import Instagram from "/assets/instagram-icon.svg";
import styles from "./nav.module.scss";

export default function Nav() {
  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.logo}><img src={Logo} alt="Little Herb Places" /></Link>
      <div className={styles.navLinks}>
        <Link to="/map">Map</Link>
        {/* <Link to="/shop">Shop</Link> */}
        <Link to="/about">About</Link>
        <Link to="https://www.instagram.com/littleherbplaces/"><img src={Instagram} alt="Little Herb Places on Instagram" /></Link>
      </div>
    </nav>
  )
}