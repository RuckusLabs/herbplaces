import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import usePlaces from '../../hooks/usePlaces';
import { browsePagePath, getBrowsePages, localVisitGuide } from '../../utilities/browse';
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
        {content.city && <section aria-labelledby="local-visit-guide"><h2 id="local-visit-guide">Plan Your Visit in {content.city}</h2><p>These categories come from the {content.places.length} listings in this collection. A place can appear in more than one category.</p><ul className={styles.guide}>{localVisitGuide(content).map(item => <li key={item.id}><h3><Link to={item.href}>{item.name}</Link></h3><p>{item.count} {item.count === 1 ? 'listing' : 'listings'} in this collection. {item.text}</p></li>)}</ul><p>Use each place’s own website for current prices, access information, and booking terms. Contact the business if a visit detail is missing from its listing.</p></section>}
        <section className={styles.ownerInvitation} aria-labelledby="local-owner-invitation"><h2 id="local-owner-invitation">{content.city ? `Run a Plant-Focused Business in ${content.city}?` : 'Is Your Business in the Directory?'}</h2><p>Find or request your listing, verify your connection, and correct essential details for free. Explore Bloom for your story, photos, customer actions, and activity reports.</p><Link className="button" to="/the-little-garden/start?plan=bloom">Find or Claim Your Business</Link> <Link to="/the-little-garden">Compare Business Plans</Link></section>
        {content.pageCount > 1 && <nav className={styles.pagination} aria-label="Browse pagination">{content.page > 1 && <Link className="button" to={browsePagePath(content.page - 1)}>Previous</Link>}<span>Page {content.page} of {content.pageCount}</span>{content.page < content.pageCount && <Link className="button" to={browsePagePath(content.page + 1)}>Next</Link>}</nav>}
        {content.city && <p><Link to="/browse">Browse every place and city</Link></p>}
      </>}
  </main>;
}
