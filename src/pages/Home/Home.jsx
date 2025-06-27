import ListComponent from "../../components/List/List";
import { Link } from "react-router-dom";
import Header from "../../components/Header/Header";
import Banner from "../../components/Banner/Banner";
import Polaroid from "../../components/Polaroid/Polaroid";
import PlaceIcon from "/assets/icons/place.svg";
import ShopIcon from "/assets/icons/shop.svg";
import { Helmet } from "react-helmet";
import styles from "./home.module.scss";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Little Herb Places | Home</title>
      </Helmet>
      <div className={styles.container}>
        <Header
          title="Rooted in Nature. Connected through herbalism."
          titleClassName="padding-r-desktop-25"
          backgroundImage={`/assets/pages/home/hero.jpg`}
        />
        <Banner className="newsletter-banner">
          <div className="newsletter-banner__images">
            <img src="/assets/pages/home/herb-image-1.jpg" alt="" />
            <img src="/assets/pages/home/herb-image-2.jpg" alt="" />
          </div>
          <div className="newsletter-banner__text">
            <h3>
              Get the latest on local herb shops, expert herbalists, and
              exclusive deals straight to your inbox.
            </h3>
            <Link className="button" to="the-little-garden">
              Join The Little Garden
            </Link>
          </div>
        </Banner>
        <section className={`${styles.section} places`}>
          <img src={PlaceIcon} alt="A icon of a storefront." />
          <h2>Places</h2>
          <p className="padding-x-desktop-2 padding-x-mobile-8">
            The world of herbalism is rich with healing spaces—apothecaries,
            gardens, workshops, and gathering places. Whether you're seeking a
            quiet retreat, a trusted herbalist, or a shop filled with nature's
            remedies, our curated guide leads you to places where plants and
            people thrive together.
          </p>
          <div className={`${styles.sectionMetaNav}`}>
            <h3>Featured Places</h3>
            <Link to="/map">View All</Link>
          </div>
          <ListComponent className={styles.places} limit={4} />
        </section>
        {/* <section className={`${styles.section} shop`}>
          <img src={ShopIcon} alt="A icon of a shopping bag." />
          <h2>Shop</h2>
          <p className="padding-x-desktop-5 padding-x-mobile-5">
            Every tincture, tea, and salve carries the care and wisdom of its
            maker. In our shop, you'll find offerings from dedicated herbalists
            and small-batch creators who honor the healing power of plants.
            Browse thoughtfully crafted remedies, sustainable skincare, and
            botanical treasures—all made with intention and integrity.
          </p>
          <div className={`${styles.sectionMetaNav}`}>
            <h3>Featured Products</h3>
            <Link to="/shop">Browse More Items</Link>
          </div>
        </section> */}
      </div>
    </>
  );
}