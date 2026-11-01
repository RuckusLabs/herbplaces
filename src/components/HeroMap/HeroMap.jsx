import { Link } from 'react-router-dom';
import Icon from '../Icons/Icon';
import styles from './heroMap.module.scss';

export default function HeroMap() {
  return <div className={styles.scene}>
    <div className={styles.map} aria-hidden="true">
      <img className={styles.basemap} src="/assets/pages/home/hero.jpg" alt="" width="900" height="1350" decoding="async" />
      <div className={styles.wash} />
    </div>
    <Link className={`button ${styles.openMap}`} to="/map"><Icon name="places" size={17} />Explore the Directory</Link>
  </div>;
}
