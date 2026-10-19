import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icons/Icon';
import Reveal from '../../components/Reveal/Reveal';
import styles from './about.module.scss';

const values = [
  { icon: 'shop', title: 'Small Places, Big Heart', text: 'Independent shops and local makers bring care, character, and knowledge to their communities. We help you find your way to them.' },
  { icon: 'lightbulb', title: 'Knowledge Worth Sharing', text: 'Plants have a way of sparking conversation. We celebrate the people who grow, make, teach, and keep that curiosity alive.' },
  { icon: 'community', title: 'Room for Everyone', text: 'You don’t need to know every plant by name. Whether you’re just curious or already deeply rooted, there’s a place for you here.' },
];

export default function About() {
  return <main id="main-content" className={styles.story}>
    <Helmet>
      <title>Our Story | Little Herb Places</title>
      <meta name="description" content="Meet Little Herb Places: a guide to independent herb shops, herbalists, gardens, and the people who connect us through a love of plants." />
    </Helmet>

    <section className={styles.hero} aria-labelledby="story-title">
      <div className={styles.heroCopy}>
        <p className={styles.pageName}>Our Story</p>
        <h1 id="story-title">Rooted in Plants.<br />Connected by <em>People.</em></h1>
        <p className={styles.lead}>A little curiosity can lead to a wonderful place.</p>
        <p>Little Herb Places is a guide to independent herb shops, herbalists, gardens, and makers. We bring them together so you can find a closer connection to plants and the people who know them best.</p>
        <Link className="button" to="/map">Find Your Little Herb Place <Icon name="arrow" size={18} /></Link>
      </div>
      <figure className={styles.heroVisual}>
        <img src="/assets/pages/home/herb-image-1.jpg" alt="A botanical tea blend surrounded by fresh flowers" width="500" height="500" fetchPriority="high" />
        <figcaption><Icon name="sun" size={50} /><span>Plants Bring<br />Us Together.</span></figcaption>
      </figure>
    </section>

    <Reveal className={styles.mission} aria-labelledby="mission-title">
      <div><Icon name="community" size={64} /><h2 id="mission-title">A Little Closer<br />to Each Other.</h2></div>
      <div className={styles.missionCopy}>
        <p>There’s more to an herb shop than what’s on its shelves. There’s a grower’s patience, a maker’s care, and a conversation that sends you home with something new to think about.</p>
        <p>We want those connections to be easier to find. Our directory gives plant-loving people a place to discover local businesses, explore somewhere new, and save the places they’d love to visit.</p>
        <p>For the herbalists, growers, and makers, The Little Garden is an invitation to share your craft and connect with a community that cares about it.</p>
      </div>
    </Reveal>

    <Reveal className={styles.values} aria-labelledby="values-title"><div className={styles.valuesInner}>
      <div className={styles.sectionIntro}><h2 id="values-title">What Keeps Us Growing.</h2><p>A few things we care about, wherever the path takes us.</p></div>
      <div className={styles.valueGrid}>
        {values.map(value => <article className={styles.value} key={value.title}>
          <Icon name={value.icon} size={68} />
          <h3>{value.title}</h3>
          <p>{value.text}</p>
        </article>)}
      </div>
    </div></Reveal>

    <Reveal className={styles.invitation} aria-labelledby="invitation-title">
      <Icon name="sparkles" size={76} />
      <h2 id="invitation-title">Follow a Little Curiosity.</h2>
      <p>Find a new favorite shop. Meet a local maker. Get to know the green spaces around you. There’s a little herb place waiting to become part of your story.</p>
      <div className={styles.actions}>
        <Link className="button" to="/map">Explore Places <Icon name="arrow" size={18} /></Link>
        <Link className="button" to="/the-little-garden">Come Grow With Us <Icon name="arrow" size={18} /></Link>
      </div>
    </Reveal>
  </main>;
}
