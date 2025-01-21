import { Link } from 'react-router-dom';
import Logo from "/assets/little-herb-places-logo.svg";
import Instagram from "/assets/instagram-icon.svg";
import styles from "./footer.module.scss";

export default function Footer() {
  return (
    <footer className="footer">
      <div className={`${styles.row} ${styles.container}`}>
        <div className={styles.column}>
          <Link to="/"><img src={Logo} className={styles.logo} alt="Little Herb Places" /></Link>
          <p>Little Herb Places is a unique platform dedicated to supporting neighborhood herbal shops and fostering a thriving community of herbal enthusiasts.</p>
          <p>© 2024 – {new Date().getFullYear()}</p>
          <Link to="https://www.instagram.com/littleherbplaces/"><img src={Instagram} alt="Little Herb Places on Instagram" /></Link>
        </div>
        <div className={styles.column}>
          <ul>
            <li><Link to="/">All Little Herb Places</Link></li>
            <li><Link to="/map">Map</Link></li>
            {/* <li><Link to="/store">Store</Link></li> */}
            <li><Link to="/about">About</Link></li>
            <li><hr /></li>
            {/* <li><Link to="/suggest-a-little-herb-place">Suggest a Little Herb Place</Link></li> */}
            {/* <li><Link to="/partnerships">Partnerships</Link></li> */}
          </ul>
        </div>
      </div>
    </footer>
  )
}