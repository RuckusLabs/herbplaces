import { Link } from 'react-router-dom';
import Logo from "/assets/little-herb-places-logo.svg";
import Instagram from "/assets/instagram-icon.svg";
import styles from "./nav.module.css";

export default function Nav() {
  return (
    <nav className={styles.nav}>
      <Link to="/herbplaces" className={styles.logo}><img src={Logo} alt="Little Herb Places" /></Link>
      <Link to="/herbplaces/about">About</Link>
      <Link to="https://www.instagram.com/littleherbplaces/"><img src={Instagram} alt="Little Herb Places on Instagram" /> Instagram</Link>
    </nav>
  )
}