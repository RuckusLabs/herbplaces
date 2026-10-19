import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import usePlaces from '../../hooks/usePlaces';
import { getPlacePhotos, getWebsiteUrl } from '../../utilities/placeDetails';
import { getPlaceCategories } from '../../utilities/placeFilters';
import { relatedPlaces } from '../../utilities/relatedPlaces';
import FavoriteButton from '../../components/FavoriteButton/FavoriteButton';
import Icon from '../../components/Icons/Icon';
import PlaceBadge from '../../components/PlaceBadge/PlaceBadge';
import List from '../../components/List/List';
import Reveal from '../../components/Reveal/Reveal';
import PhotoLightbox from '../../components/PhotoLightbox/PhotoLightbox';
import PlaceManagement from '../../components/PlaceManagement/PlaceManagement';
import styles from './place.module.scss';

export default function Place() {
  const { slug } = useParams();
  const { places, loading, error, retry } = usePlaces();
  const place = places.find(item => item.urlSlug === slug);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [photoRatios, setPhotoRatios] = useState({});
  const [galleryWidth, setGalleryWidth] = useState(0);
  const gallery = useRef(null);
  const activePhoto = useRef(0);
  const photos = getPlacePhotos(place);

  useEffect(() => {
    setPhotoIndex(0);
    setLightboxIndex(null);
    activePhoto.current = 0;
    gallery.current?.scrollTo({ left: 0, behavior: 'instant' });
  }, [slug, place?.content_version]);

  useEffect(() => {
    const element = gallery.current;
    if (!element || !('ResizeObserver' in window)) return;
    let previousWidth = 0;
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth;
      if (width === previousWidth) return;
      previousWidth = width;
      setGalleryWidth(width);
      element.scrollTo({ left: width * activePhoto.current, behavior: 'instant' });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [place?.id]);

  const showPhoto = index => {
    const next = (index + photos.length) % photos.length;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    gallery.current?.scrollTo({ left: gallery.current.clientWidth * next, behavior });
  };

  if (loading) return <main id="main-content" className={styles.page}><div className={styles.loading} role="status"><Icon name="sprout" size={60} /><p>Getting to Know This Little Place…</p></div></main>;
  if (!place) return <main id="main-content" className={styles.page}><div className={styles.loading}><Icon name="leaf" size={64} /><h1>{error ? 'A Little Pause in the Garden.' : 'A Little Off the Beaten Path.'}</h1><p>{error || 'We couldn’t find this little place.'}</p>{error && <button className="button" onClick={retry}>Try Again</button>}<Link className="button" to="/map">Back to All Places</Link></div></main>;

  const photoRatio = photoRatios[photos[photoIndex]];
  const galleryHeight = galleryWidth && photoRatio ? galleryWidth / photoRatio : undefined;
  const tags = getPlaceCategories(place);
  const website = getWebsiteUrl(place.website);
  const location = [place.city, place.state].filter(Boolean).join(', ');
  const address = [place.address, location, place.zip].filter(Boolean).join(', ');
  const others = relatedPlaces(place, places);

  return <main id="main-content" className={styles.page}>
    <Helmet><title>{place.name} in {location} | Little Herb Places</title><meta name="description" content={place.tagline || `Discover ${place.name} in ${location}.`} /></Helmet>
    <Link to="/map" className={styles.backLink}><Icon name="arrow" size={17} />All Places</Link>
    <header className={styles.heading}>
      <div>
        <div className={styles.editAction}><PlaceManagement key={place.id} place={place} placement="top" /></div>
        <p className={styles.location}><Icon name="pin" size={23} />{location}</p>
        <div className={styles.nameLine}><h1>{place.name}</h1><PlaceBadge place={place} /></div>
        {place.tagline && <p className={styles.tagline}>{place.tagline}</p>}
        {tags.length > 0 && <ul className={styles.tags} aria-label="Place Tags">
          {tags.map(tag => <li key={tag.id}>
            <Link to={`/map?category=${tag.id}`} className={`button ${styles.tag}`}>
              <Icon name={tag.icon} size={24} />{tag.name}
            </Link>
          </li>)}
        </ul>}
      </div>
      <div className={styles.headingActions}><FavoriteButton itemId={place.id} className={`button ${styles.saveButton}`} showText /></div>
    </header>
    <section className={styles.photos} aria-label={`Photos of ${place.name}`} aria-roledescription="carousel">
      <div className={styles.photoFrame}>
        <div ref={gallery} className={styles.photoGallery} style={{ height: galleryHeight || 'min(480px, 60svh)' }} tabIndex={0} aria-label="Photo gallery. Use the left and right arrow keys to browse." onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); showPhoto(photoIndex + (event.key === 'ArrowRight' ? 1 : -1)); } }} onScroll={event => { const next = Math.max(0, Math.min(photos.length - 1, Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))); activePhoto.current = next; setPhotoIndex(next); }}>
          {photos.map((photo, index) => <button type="button" key={`${place.id}-${photo}`} className={styles.gallerySlide} aria-label={`Open Photo ${index + 1} of ${photos.length} in Full View`} onClick={() => setLightboxIndex(index)}><img src={photo} width="1200" height="700" alt={place.photo_alt?.[photo] || `${place.name} — photo ${index + 1} of ${photos.length}`} className={styles.galleryPhoto} onLoad={event => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (!naturalWidth || !naturalHeight) return;
            const ratio = naturalWidth / naturalHeight;
            setPhotoRatios(previous => previous[photo] === ratio ? previous : { ...previous, [photo]: ratio });
          }} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" onError={event => { if (!event.currentTarget.src.endsWith('/assets/pages/home/hero.jpg')) event.currentTarget.src = '/assets/pages/home/hero.jpg'; }} /></button>)}
        </div>
        {photos.length > 1 && <><button className={`button ${styles.galleryNav} ${styles.previous}`} aria-label="Previous Photo" onClick={() => showPhoto(photoIndex - 1)}><Icon name="arrow" size={19} /></button><button className={`button ${styles.galleryNav} ${styles.next}`} aria-label="Next Photo" onClick={() => showPhoto(photoIndex + 1)}><Icon name="arrow" size={19} /></button></>}
        <button className={`button ${styles.openPhoto}`} onClick={() => setLightboxIndex(photoIndex)}><Icon name="expand" size={17} />View Full Image</button>
        <span className={styles.counter} aria-live="polite">{photoIndex + 1} / {photos.length}</span>
      </div>
      {photos.length > 1 && <div className={styles.thumbnails} aria-label="Choose a photo">{photos.map((photo, index) => <button key={photo} aria-label={`View Photo ${index + 1}`} aria-pressed={photoIndex === index} className={styles.thumbnail} onClick={() => showPhoto(index)}><img src={photo} width="90" height="65" alt="" loading="lazy" decoding="async" /></button>)}</div>}
    </section>
    <PhotoLightbox photos={photos} index={lightboxIndex} name={place.name} onClose={() => setLightboxIndex(null)} onChange={index => { setLightboxIndex(index); showPhoto(index); }} />
    <div className={styles.details}>
      <Reveal as="section" className={styles.story}><h2>A Little About {place.name}</h2>{(place.description || '').split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</Reveal>
      <aside className={styles.visit} aria-labelledby="visit-title">
        <Icon name="shop" size={60} />
        <h2 id="visit-title">Plan a Little Visit.</h2>
        <div className={styles.visitDetails}>
          {address && <div className={styles.visitRow}>
            <Icon name="pin" size={20} />
            <p className={styles.address}>{place.address && <>{place.address}<br /></>}{location}{place.zip && ` ${place.zip}`}</p>
          </div>}
          {place.hours && <div className={styles.visitRow}>
            <Icon name="clock" size={20} />
            <div><h3 className={styles.visitLabel}>Opening hours</h3><p className={styles.address}>{place.hours}</p></div>
          </div>}
          {place.phone && <div className={styles.visitRow}>
            <Icon name="phone" size={20} />
            <a className={styles.phone} href={`tel:${place.phone}`}>{place.phone}</a>
          </div>}
        </div>
        <div className={styles.visitActions}>
          {address && <a className="button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer"><Icon name="pin" size={20} />Get Directions</a>}
          {website && <a className="button" href={website} target="_blank" rel="noopener noreferrer"><Icon name="globe" size={20} />Visit Their Website <Icon name="arrow" size={17} /></a>}
          {(place.social_links || []).map((link, index) => getWebsiteUrl(link.url) && <a className="button" href={getWebsiteUrl(link.url)} key={index} target="_blank" rel="noopener noreferrer"><Icon name="link" size={20} />{link.label}<Icon name="arrow" size={17} /></a>)}
          <PlaceManagement key={place.id} place={place} placement="visit" />
        </div>
      </aside>
    </div>
    {others.length > 0 && <Reveal className={styles.related}><div className={styles.sectionHeading}><h2>Keep Wandering.</h2><Link to="/map" className="button">Explore All Places <Icon name="arrow" size={17} /></Link></div><List places={others} /></Reveal>}
  </main>;
}
