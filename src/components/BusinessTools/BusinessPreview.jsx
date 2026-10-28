import { useState } from 'react';
import PropTypes from 'prop-types';
import Icon from '../Icons/Icon';
import PhotoLightbox from '../PhotoLightbox/PhotoLightbox';
import styles from './businessPreview.module.scss';

const photo = (name, alt) => ({ src: `/assets/examples/${name}.webp`, alt });
const shop = photo('shop-interior', 'Warm sunlight across a plant-filled shop and wooden workshop table');
const jars = photo('tea-jars', 'Glass jars filled with colorful loose-leaf tea blends');
const herbs = photo('herb-spoons', 'Five wooden scoops holding different dried herbs and petals');
const pouring = photo('tea-pouring', 'A hand pouring tea from a glass teapot into a cup outdoors');
const tea = photo('chamomile-tea', 'Chamomile blossoms floating in a dark ceramic cup of tea');
const credits = [
  ['Orhan Pergel', 'https://unsplash.com/photos/W074RWPKjcQ'],
  ['Tropical Tea', 'https://unsplash.com/photos/BUP1_QfksKk'],
  ['Carmen Grobler', 'https://unsplash.com/photos/0i2y63hc7fo'],
  ['Julia Ivanina', 'https://unsplash.com/photos/IWHX5Jdr9UI'],
  ['Gaia&Co', 'https://unsplash.com/photos/1X7SJhapVLM'],
];

export default function BusinessPreview({ thrive = false, growth = false }) {
  const gallery = thrive ? [jars, shop, herbs, pouring] : [shop, jars, herbs, tea];
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const selectPhoto = index => setPhotoIndex((index + gallery.length) % gallery.length);
  const selected = gallery[photoIndex];
  return <figure className={styles.preview} aria-label={`Example ${thrive ? 'Thrive' : 'Bloom'} business listing`}>
    <div className={styles.frame}>
      <div className={styles.chrome}><span aria-hidden="true"><i /><i /><i /></span><span>littleherbplaces.com/place/willow-root</span><span className={styles.exampleLabel}>Example</span></div>
      <div className={styles.siteHeader}><img src="/assets/little-herb-places-logo.svg" alt="" width="42" height="42" /><span>Explore Places <span>Our Story</span><span>Business Plans & Pricing</span></span><Icon name="heart" size={23} /><span className={styles.miniJoin}>Join the Community <Icon name="arrow" size={11} /></span></div>
      <div className={styles.profilePage}>
        <span className={styles.backLink}><Icon name="arrow" size={12} />All Places</span>
        <header className={styles.profileHeader}>
          <div><p className={styles.location}><Icon name="pin" size={18} />Portland, Oregon</p><h3>Willow & Root Apothecary</h3><p className={styles.tagline}>Small-batch teas, everyday rituals, and a little room to grow.</p><div className={styles.categories}><span><Icon name="shop" size={20} />Herb Shops & Apothecaries</span><span><Icon name="craft" size={20} />Classes & Workshops</span></div></div>
          <span className={styles.saveAction}><Icon name="heart" size={24} />Save Place</span>
        </header>
        {(growth || thrive) && <div className={styles.highlights}>
          <span className={styles.primaryAction}>{thrive ? 'Explore Our Workshops' : 'Shop Our Tea Collection'} <Icon name="arrow" size={12} /></span>
          <h4>What You’ll Find Here</h4><div className={styles.tags}><span>Loose-Leaf Teas</span><span>Bulk Herbs</span><span>Botanical Gifts</span><span>Small-Group Classes</span></div>
          <div className={styles.access}><p><strong>Languages:</strong> English and Spanish</p><p><strong>Access Information From the Business:</strong> Step-free shop entrance, wide browsing aisles, and seating at the tasting table. Contact us before a workshop if you’d like help planning your visit.</p></div>
          <section className={styles.announcement}><h4>A New Season on the Tea Shelf.</h4><p>Our autumn blends have arrived, with bright citrus, fragrant flowers, and warming spices. Drop in for a cup at the tasting table, meet the ingredients, and take a little inspiration home.</p><span className={styles.textLink}>Learn More <Icon name="arrow" size={11} /></span></section>
          {thrive && <>
            <section className={styles.offerings}><h4>A Little of What We Offer</h4><div className={styles.offeringGrid}>
              <article><img src={tea.src} alt={tea.alt} width="700" height="525" loading="lazy" /><p className={styles.overline}>Product</p><h5>Seasonal Tea Blend</h5><p>A floral, caffeine-free blend of chamomile, lemon balm, and rose petals, mixed in small batches. Brew a pot for a slow afternoon, or give someone a little moment to themselves.</p><p className={styles.itemPrice}>$18 · 50 g loose-leaf pouch</p><span className={styles.cardAction}>View at Their Shop <Icon name="arrow" size={11} /></span></article>
              <article><img src={pouring.src} alt={pouring.alt} width="700" height="525" loading="lazy" /><p className={styles.overline}>Service</p><h5>A Tea Consultation</h5><p>Spend an unhurried hour exploring flavor, aroma, and your favorite daily rituals with our tea blender. Taste three infusions and leave with a personal blend and simple brewing notes.</p><p className={styles.itemPrice}>$65 · 60-minute tasting</p><span className={styles.cardAction}>Learn More & Book <Icon name="arrow" size={11} /></span></article>
            </div></section>
            <section className={styles.offerings}><h4>Come Learn Something New</h4><article className={styles.workshop}><img src={herbs.src} alt={herbs.alt} width="800" height="600" loading="lazy" /><div><p className={styles.overline}>Workshop or Event</p><h5>A Seasonal Tea Workshop</h5><p>Get to know six herbs through scent, touch, and taste, then create a blend to take home. All ingredients, tasting cups, and a recipe booklet are included. Beginners are very welcome.</p><p className={styles.workshopMeta}>Saturday, November 14 · 2–4 pm<br />Pacific Time · In the shop<br />$35 per person · Materials included</p><span className={styles.cardAction}>Details & Registration <Icon name="arrow" size={11} /></span></div></article></section>
          </>}
        </div>}
        <section className={styles.photos} aria-label="Example listing photo gallery">
          <button type="button" className={styles.galleryStage} onClick={() => setLightboxIndex(photoIndex)} aria-label={`Open Example Photo ${photoIndex + 1} in Full View`}><img src={selected.src} alt={selected.alt} width="1100" height="733" loading="lazy" /></button>
          <div className={styles.galleryTools}><button type="button" onClick={() => setLightboxIndex(photoIndex)} className={styles.fullImage}><Icon name="expand" size={12} />View Full Image</button><div><button type="button" aria-label="Previous Example Photo" onClick={() => selectPhoto(photoIndex - 1)}><Icon name="arrow" size={13} className={styles.previous} /></button><span aria-live="polite">{photoIndex + 1} / {gallery.length}</span><button type="button" aria-label="Next Example Photo" onClick={() => selectPhoto(photoIndex + 1)}><Icon name="arrow" size={13} /></button></div></div>
          <div className={styles.thumbnails}>{gallery.map((image, index) => <button type="button" key={image.src} onClick={() => selectPhoto(index)} aria-label={`View Example Photo ${index + 1}`} aria-pressed={photoIndex === index}><img src={image.src} alt="" width="90" height="65" loading="lazy" /></button>)}</div>
        </section>
        <div className={styles.profileBody}>
          <section className={styles.story}><h4>A Little About Willow & Root Apothecary</h4><p>Willow & Root is a neighborhood apothecary for people who like to know the plants in their cup. Our shelves bring together loose-leaf teas, dried herbs, and thoughtful gifts from small makers. Come in with a favorite flavor, a question, or simply a little curiosity.</p><p>We blend our teas in small batches and choose ingredients for their character, freshness, and the stories behind them. You’ll find familiar favorites alongside seasonal discoveries, with time to smell the jars, compare a few leaves, and find something that feels like you. Bring a clean jar for refills, or let us put together a gift.</p><p>The tasting table is the heart of our shop. It’s where we share brewing tips, meet our neighbors, and host welcoming, hands-on classes. Whether you’re taking your first sip of herbal tea or building a collection of your own, there’s a place for you here.</p></section>
          <aside className={styles.visit}><Icon name="shop" size={43} /><h4>Plan a Little Visit.</h4><div className={styles.visitRow}><Icon name="pin" size={15} /><div><h5>Address</h5><p>123 Example Lane<br />Portland, Oregon 97214</p></div></div><div className={styles.visitRow}><Icon name="clock" size={15} /><div><h5>Opening Hours</h5><p>Tuesday–Friday · 10 am–6 pm<br />Saturday · 10 am–4 pm<br />Sunday–Monday · Closed</p></div></div><div className={styles.visitRow}><Icon name="phone" size={15} /><div><h5>Phone</h5><p>(503) 555-0142</p></div></div><div className={styles.visitActions}><span><Icon name="pin" size={16} />Get Directions</span><span><Icon name="globe" size={14} />Visit Their Website <Icon name="arrow" size={11} /></span><span><Icon name="link" size={14} />Instagram <Icon name="arrow" size={11} /></span></div></aside>
        </div>
      </div>
      <div className={styles.siteFooter}><div><img src="/assets/little-herb-places-logo.svg" alt="" width="44" height="49" /><p>Rooted in nature.<br />Connected through community.</p></div><div><strong>Wander a Little</strong><span>Explore Places</span><span>Our Story</span><span>Your Saved Places</span></div><div><strong>Put Down Roots</strong><span>For Business Owners</span><span>Join the Community</span><span>Get in Touch</span></div></div>
    </div>
    <figcaption className={styles.caption}>Illustrative listing · not a real business. Photos on Unsplash by {credits.map(([name, url], index) => <span key={url}>{index > 0 && ', '}<a href={url} target="_blank" rel="noopener noreferrer">{name}</a></span>)}.</figcaption>
    <PhotoLightbox photos={gallery.map(image => image.src)} descriptions={Object.fromEntries(gallery.map(image => [image.src, image.alt]))} index={lightboxIndex} name="Willow & Root Apothecary · Example" onClose={() => setLightboxIndex(null)} onChange={index => { setLightboxIndex(index); selectPhoto(index); }} />
  </figure>;
}
BusinessPreview.propTypes = { thrive: PropTypes.bool, growth: PropTypes.bool };
