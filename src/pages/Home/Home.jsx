import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import ListComponent from '../../components/List/List';
import Icon from '../../components/Icons/Icon';
import Reveal from '../../components/Reveal/Reveal';
import HeroMap from '../../components/HeroMap/HeroMap';
import { categories } from '../../utilities/placeFilters';
import styles from './home.module.scss';

export default function Home() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const search = event => {
    event.preventDefault();
    navigate(`/map?view=map${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''}`);
  };
  return <>
    <Helmet>
      <title>Little Herb Places — Find your connection to nature</title>
      <meta name="description" content="A thoughtful guide to independent herb shops, apothecaries, herbalists, and gardens. Discover a little herb place near you." />
    </Helmet>
    <main id="main-content" className={styles.home}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.heroIntro}><Icon name="map" size={22} />Your Guide to Plant-Loving Places</p>
          <h1 id="hero-title">A Little Closer<br />to <em>Nature.</em></h1>
          <p>Follow a little curiosity. Find independent herb shops,<br className={styles.desktopBreak} /> herbalists, gardens, and gatherings that bring<br className={styles.desktopBreak} /> you closer to plants — and each other.</p>
          <form className={styles.search} onSubmit={search} role="search">
            <Icon name="pin" size={21} />
            <label className={styles.srOnly} htmlFor="home-search">Search by city, state, or place</label>
            <input id="home-search" type="search" placeholder="Your city, state, or a little herb place" value={query} onChange={event => setQuery(event.target.value)} />
            <button type="submit" className="button">Explore the Map <Icon name="arrow" size={18} /></button>
          </form>
          <div className={styles.heroCategories} aria-label="Explore by kind of place">{categories.map(category => <Link key={category.id} to={`/map?view=map&category=${category.id}`}><Icon name={category.icon} size={28} />{category.short}</Link>)}</div>
        </div>
        <HeroMap />
      </section>
      <div className={styles.values} aria-label="Our values"><div className={styles.valuesInner}>
        <span><Icon name="shop" size={34} /> Small businesses, big heart</span><i />
        <span><Icon name="lightbulb" size={34} /> Rooted in plant wisdom</span><i />
        <span><Icon name="heart" size={34} /> A community worth growing</span>
      </div></div>
      <Reveal className={styles.discover} aria-labelledby="discover-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="discover-title">Find Your Kind of Place.</h2></div>
          <Link to="/map" className={`button ${styles.textLink}`}>Explore the Directory <Icon name="arrow" size={18} /></Link>
        </div>
        <div className={styles.categories}>
          {categories.map(category => <Link key={category.id} to={`/map?category=${category.id}`} className={styles.category}>
            <div className={styles.categoryTop}><Icon name={category.icon} size={68} /></div>
            <h3>{category.name}</h3><p>{category.description}</p><Icon className={styles.categoryArrow} name="arrow" size={20} />
          </Link>)}
        </div>
      </Reveal>
      <Reveal className={styles.featured} aria-labelledby="featured-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="featured-title">Somewhere Worth Finding.</h2></div>
          <Link to="/map" className={`button ${styles.textLink}`}>View All Places <Icon name="arrow" size={18} /></Link>
        </div>
        <ListComponent limit={3} prioritizeFeatured />
        <p className={styles.saveNote}><Icon name="heart" size={25} /> See a place you love? Save it for a slower day.</p>
      </Reveal>
      <Reveal className={styles.community} aria-labelledby="community-title"><div className={styles.communityInner}>
        <div className={styles.communityImage}><img src="/assets/pages/home/herb-image-1.jpg" alt="A botanical tea blend surrounded by fresh flowers" width="500" height="500" loading="lazy" decoding="async" /><span>Plants bring us together.</span></div>
        <div className={styles.communityCopy}><h2 id="community-title">Good Things Grow<br />With <em>Good Company.</em></h2><p>For the growers, the makers, the endlessly curious.<br />The Little Garden is a place to share your craft, put down roots, and connect with a community that cares.</p><Link to="/the-little-garden" className={`button ${styles.primaryLink}`}>Come Grow With Us <Icon name="arrow" size={18} /></Link><Link to="/about" className={`button ${styles.storyLink}`}>A Little More About Us</Link></div>
      </div></Reveal>
      <section className={styles.closing}><div className={styles.closingInner}>
        <Icon name="community" size={50} /><p>There’s a little herb place for everyone.</p><Link to="/map" className={`button ${styles.textLink}`}>Let’s Find Yours <Icon name="arrow" size={18} /></Link>
      </div></section>
    </main>
  </>;
}
