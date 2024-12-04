import Logo from "/assets/little-herb-places-circle-logo.svg";
import styles from "./footer.module.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className={styles.container}>
        <img src={Logo} alt="Little Herb Places" />
        <p>© {new Date().getFullYear()} | Little Herb Places</p>
      </div>
    </footer>
  )
}