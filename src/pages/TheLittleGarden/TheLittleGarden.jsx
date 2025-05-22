import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import Header from "../../components/Header/Header";
import styles from "./thelittlegarden.module.scss"

import SproutIcon from "/assets/icons/sprout.svg";
import BloomIcon from "/assets/icons/bloom.svg";
import ThriveIcon from "/assets/icons/thrive.svg";
import EvergreenIcon from "/assets/icons/evergreen.svg";

export default function TheLittleGarden() {
  return (
    <>
      <Helmet>
        <title>Little Herb Places | The Little Garden</title>
      </Helmet>
      <Header title="The Little Garden" backgroundImage={`/assets/pages/the-little-garden/hero.jpg`} />
      <section className={`${styles.container} ${styles.intro}`}>
        <h3>Nurture your herbal practice with The&nbsp;Little&nbsp;Garden</h3>
        <p className="padding-r-desktop-8">You pour your heart into your craft—growing, blending, and creating with nature&apos;s gifts. The&nbsp;Little&nbsp;Garden is here to help your work flourish. Whether you&apos;re a seasoned herbalist or just beginning your journey, our platform connects you with those who seek the wisdom and healing of plants.</p>
      </section>
      <section className={`${styles.container} ${styles.signup}`}>
        <h3 className="padding-l-desktop-23">A place to share, grow, and be seen</h3>
        <p className="padding-l-desktop-18">Choose a plan that aligns with your path, and let your herbal offerings reach a wider community.</p>
      </section>
      <section className={styles.containesr}>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.content}>
              <h4><img src={SproutIcon} alt="A sprout icon." /> Sprout</h4>
              <p className="padding-r-desktop-10">Plant the seed and start your journey.</p>
              <ul>
                <li>Join the community.</li>
              </ul>
            </div>
            <div className={styles.meta}>
              <p>Free</p>
              <Link className={styles.button} to="/the-little-garden/sprout">
                Get Sprout
              </Link>
            </div>
          </div>
          <div className={`${styles.card} ${styles.cardHidden}`}>
            <div className={styles.content}>
              <h4><img src={BloomIcon} alt="A bloom icon." /> Bloom</h4>
              <p>Let your offerings unfurl and reach more hearts.</p>
              <ul>
                <li>Verified Place Badge</li>
                <li>Claim your Place</li>
                <li>Add images</li>
                <li>Adjust Place content</li>
              </ul>
            </div>
            <div className={styles.meta}>
              <p>$10/month</p>
              <Link className={styles.button} to="#">
                Get Bloom
              </Link>
              <span className={styles.comingSoon}>Coming soon</span>
            </div>
          </div>
          <div className={`${styles.card} ${styles.cardHidden}`}>
            <div className={styles.content}>
              <h4><img src={ThriveIcon} alt="A thrive icon." /> Thrive</h4>
              <p>Deepen your roots and share your wisdom.</p>
              <ul>
                <li>Everything in Bloom</li>
                <li>Feature up to 10 products.</li>
                <li>Social media feature.</li>
              </ul>
            </div>
            <div className={styles.meta}>
              <p>$15/month</p>
              <Link className={styles.button} to="#">
                Get Thrive
              </Link>
              <span className={styles.comingSoon}>Coming soon</span>
            </div>
          </div>
          {/* <div className={styles.card}>
            <div className={styles.content}>
              <h4><img src={EvergreenIcon} alt="An evergreen icon." /> Evergreen</h4>
              <p>Stand tall, be seen, and grow without limits.</p>
              <ul>
                <li>Everything in Thrive.</li>
                <li>Feature up to 30 products.</li>
                <li>Place Badge.</li>
                <li>Featured interview.</li>
              </ul>
            </div>
            <div className={styles.meta}>
              <p>$50/month</p>
              <Link className={styles.button} to="#">
                Get Evergreen
              </Link>
            </div>
          </div> */}
        </div>
      </section>
    </>
  )
}