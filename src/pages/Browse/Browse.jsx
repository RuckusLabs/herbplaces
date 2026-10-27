import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import usePlaces from '../../hooks/usePlaces';
import { browsePagePath, getBrowsePages } from '../../utilities/browse';
import { canonicalUrl, getRouteSeo, normalizePath } from '../../utilities/seo';
import Seo from '../../components/Seo/Seo';
import List from '../../components/List/List';
import styles from './browse.module.scss';

export default function Browse() {
  const { pathname } = useLocation();
  const { places, loading, error, retry } = usePlaces();
  const pages = useMemo(() => getBrowsePages(places), [places]);
  const content = pages.find(page => page.path === normalizePath(pathname));
  const metadata = { ...getRouteSeo(pathname), title: `${content?.heading || 'Browse Places'} | Little Herb Places`,
    description: content?.description || 'Explore the directory of independent herb places.', canonical: canonicalUrl(pathname), robots: content ? 'index,follow' : 'noindex,follow' };
  return <main id="main-content" className={styles.page}>
    <Seo metadata={metadata} />
    <Link to="/map">Explore the map</Link>
    <h1>{content?.heading || (loading ? 'Finding your little places…' : 'A little further afield.')}</h1>
    {error ? <div role="alert"><p>{error}</p><button className="button" onClick={retry}>Try Again</button></div>
      : loading ? <p role="status">Gathering little places…</p> : !content ? <p>This collection is not available. <Link to="/browse">Browse all places</Link>.</p> : <>
        <p>{content.description}</p>
        {content.city && <p>Use the listings below to explore what each place offers. Check directly with the business for current opening hours, availability, and workshop dates.</p>}
        {content.collections?.length > 0 && <section aria-labelledby="local-collections"><h2 id="local-collections">{content.city ? 'More to explore here' : 'Explore by city'}</h2><ul className={styles.collections}>{content.collections.map(collection => <li key={collection.path}><Link to={collection.path}>{collection.category ? collection.heading : `${collection.city}, ${collection.region}`} <span>{collection.places.length} places</span></Link></li>)}</ul></section>}
        <section aria-labelledby="browse-results"><h2 id="browse-results">{content.city ? 'Places to get to know' : 'Every little place'}</h2><List places={content.places} /></section>
        {content.pageCount > 1 && <nav className={styles.pagination} aria-label="Browse pagination">{content.page > 1 && <Link className="button" to={browsePagePath(content.page - 1)}>Previous</Link>}<span>Page {content.page} of {content.pageCount}</span>{content.page < content.pageCount && <Link className="button" to={browsePagePath(content.page + 1)}>Next</Link>}</nav>}
        {content.city && <p><Link to="/browse">Browse every place and city</Link></p>}
      </>}
  </main>;
}
