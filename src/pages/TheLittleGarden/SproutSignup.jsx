import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icons/Icon';
import Reveal from '../../components/Reveal/Reveal';
import styles from './thelittlegarden.module.scss';

export default function SproutSignup() {
  return <main id="main-content" className={styles.signupPage}>
    <Helmet><title>Join Sprout | The Little Garden | Little Herb Places</title></Helmet>
    <Link to="/the-little-garden" className={styles.backLink}><Icon name="arrow" size={17} />The Little Garden</Link>
    <Reveal as="div" className={styles.signupLayout}>
      <section className={styles.signupIntro}><Icon name="sprout" size={80} /><h1>Every Good Thing Starts With a Little Seed.</h1><p>Join Sprout, our free community plan, and make a little room for connection. For herbalists, growers, makers, and the endlessly plant-curious.</p><p>Keep your favorite places close with a free account, and join the community below for updates.</p><Link to="/register?next=%2Ffavorites" className="button">Create a Free Account <Icon name="arrow" size={18} /></Link></section>
      <section className={styles.signupCard} aria-labelledby="signup-title">
        <h2 id="signup-title">Join Sprout</h2><p>Free to join. A little place to start growing.</p>
        <form action="https://littleherbplaces.us11.list-manage.com/subscribe/post?u=ac649b78dd0024f5b2ecd08e5&id=566234165b&f_id=0063c6e3f0" method="POST" target="_blank" rel="noopener noreferrer" className={styles.form}>
          <input type="hidden" name="f_id" value="0063c6e3f0" />
          <label htmlFor="sprout-email">Email (Required)</label><input id="sprout-email" type="email" autoComplete="email" name="EMAIL" placeholder="Your Email" required />
          <label htmlFor="sprout-first-name">First Name</label><input id="sprout-first-name" type="text" autoComplete="given-name" name="FNAME" placeholder="First Name" />
          <label htmlFor="sprout-last-name">Last Name</label><input id="sprout-last-name" type="text" autoComplete="family-name" name="LNAME" placeholder="Last Name" />
          <label htmlFor="sprout-shop">Shop Name</label><input id="sprout-shop" type="text" autoComplete="organization" name="COMPANY" placeholder="Shop Name (Optional)" />
          <div className={styles.honeypot} aria-hidden="true"><input type="text" name="b_ac649b78dd0024f5b2ecd08e5_566234165b" tabIndex="-1" defaultValue="" /></div>
          <button type="submit" className="button">Sign Up for Sprout <Icon name="arrow" size={18} /></button>
          <p className={styles.formNote}>Your signup confirmation opens in a new tab.</p>
        </form>
      </section>
    </Reveal>
  </main>;
}
