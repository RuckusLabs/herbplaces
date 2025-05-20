import { Link } from 'react-router-dom';
import Logo from "/src/assets/little-herb-places-logo.svg?react";
import Instagram from "/src/assets/instagram-icon.svg?react";
import TikTok from "/src/assets/tiktok-icon.svg?react";
import styles from "./footer.module.scss";

export default function Footer() {
  return (
    <footer className="footer">
      <div className={`${styles.row} ${styles.container}`}>
        <div className={styles.column}>
          <Link to="/"><Logo /></Link>
          <p>Little Herb Places is a unique platform dedicated to supporting neighborhood herbal shops and fostering a thriving community of herbal enthusiasts.</p>
          <p>© 2024 – {new Date().getFullYear()}</p>
          <div className={styles.socialRow}>
            <Link to="https://www.instagram.com/littleherbplaces/"><Instagram /></Link>
            <Link to="https://www.tiktok.com/@littleherbplaces"><TikTok /></Link>
          </div>
        </div>
        {/* <div className={styles.column}>
          <ul>
            <li><Link to="/map">Explore</Link></li>
            <li><Link to="/store">Store</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/the-little-garden">The Little Garden</Link></li>
            <li><hr /></li>
            <li><Link to="/suggest-a-little-herb-place">Suggest a Little Herb Place</Link></li>
            <li><Link to="/partnerships">Partnerships</Link></li>
          </ul>
        </div> */}
      </div>
    </footer>
  )
}