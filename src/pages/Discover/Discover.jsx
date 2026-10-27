import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import usePlaces from '../../hooks/usePlaces';
import useGrowthProfiles from '../../hooks/useGrowthProfiles';
import { growthEnabled } from '../../utilities/growthApi';
import { discoveryItems, filterDiscovery } from '../../utilities/discovery';
import { canonicalUrl, getRouteSeo, getDiscoverySeo, normalizePath } from '../../utilities/seo';
import Seo from '../../components/Seo/Seo';
import { OfferingCard } from '../../components/BusinessTools/PlaceHighlights';
import growthStyles from '../../components/BusinessTools/growth.module.scss';
import styles from '../Browse/browse.module.scss';

export default function Discover() {
  const { pathname }=useLocation(); const [params,setParams]=useSearchParams();
  const { places,loading,error,retry }=usePlaces(); const growth=useGrowthProfiles();
  const items=useMemo(()=>discoveryItems(places,growth.profiles,growth.now),[places,growth.profiles,growth.now]);
  const path=normalizePath(pathname); const detail=path!=='/discover'; const item=items.find(entry=>entry.path===path);
  const query=params.get('q') || ''; const kind=params.get('kind') || '';
  const selected=filterDiscovery(items,query,kind);
  const metadata=item ? getDiscoverySeo(item) : { ...getRouteSeo(path),title:'Herbal Products, Services & Workshops | Little Herb Places',description:'Discover products, herbal consultations, workshops, and events from independent herb businesses. Shop or book directly with each business.',canonical:canonicalUrl(path),robots:growthEnabled && items.length && !detail && !params.size ? 'index,follow' : 'noindex,follow' };
  const update=(key,value)=>{ const next=new URLSearchParams(params);if(value) next.set(key,value);else next.delete(key);setParams(next,{ replace:true }); };
  return <main id="main-content" className={styles.page}><Seo metadata={metadata} /><h1>{item?.title || 'A little more to discover.'}</h1>
    {!growthEnabled ? <p>Offerings and events are being prepared for the Thrive pilot. <Link to="/browse">Discover places near you</Link>.</p>
      : error || growth.error ? <div role="alert"><p>{error || growth.error}</p><button className="button" onClick={()=>{ retry();growth.refresh(); }}>Try Again</button></div>
        : loading || growth.loading ? <p role="status">Gathering offerings and events…</p>
          : detail ? item ? <><p>From <Link to={`/place/${item.place.urlSlug}`}>{item.place.name}</Link> · {[item.place.city,item.place.state].filter(Boolean).join(', ')}</p><div className={growthStyles.cards}><OfferingCard item={item} placeId={String(item.place.id)} event={item.event} /></div><p><Link to="/discover">Explore all offerings and events</Link></p></> : <p>This item is no longer available, or the event has ended. <Link to="/discover">Explore current offerings and events</Link>.</p>
            : <><p>Find something made with care, book time with an herbalist, or join a workshop. You’ll shop and book directly with each business.</p><form className={growthStyles.form} onSubmit={event=>event.preventDefault()} role="search"><div className={growthStyles.row}><label>Search offerings, businesses, or cities<input type="search" value={query} onChange={event=>update('q',event.target.value)} /></label><label>Kind of offering<select value={kind} onChange={event=>update('kind',event.target.value)}><option value="">Everything</option><option value="product">Products</option><option value="service">Services</option><option value="events">Workshops & events</option></select></label></div></form><p role="status">{selected.length} {selected.length===1 ? 'discovery' : 'discoveries'}</p>
              <div className={growthStyles.cards}>{selected.map(entry=><article key={entry.path}>{entry.image && <img src={entry.image} alt={entry.image_alt || entry.title} width="600" height="450" loading="lazy" />}<h2><Link to={entry.path}>{entry.title}</Link></h2><p>{entry.description}</p><p>From <Link to={`/place/${entry.place.urlSlug}`}>{entry.place.name}</Link> · {entry.place.city}, {entry.place.state}</p>{entry.event && <p>{new Intl.DateTimeFormat('en-US',{ dateStyle:'medium',timeStyle:'short',timeZone:entry.timezone }).format(new Date(entry.starts_at))} · {entry.timezone}</p>}{entry.price && <p>{entry.price}</p>}</article>)}</div>
              {!selected.length && <p>{items.length ? 'Try a different search or kind of offering.' : 'Our first Thrive businesses are preparing their offerings. Explore the directory while things take root.'} <Link to="/browse">Browse places</Link>.</p>}
            </>}
  </main>;
}
