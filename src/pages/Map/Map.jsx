import { useAuth } from '../../contexts/AuthContext';
import { Helmet } from 'react-helmet';
import { lazy, Suspense, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import styles from './map.module.scss';
import ListComponent from '../../components/List/List';
import Icon from '../../components/Icons/Icon';
import PlaceSearch from '../../components/PlaceSearch/PlaceSearch';
import NearbyPlaces from '../../components/NearbyPlaces/NearbyPlaces';
import Pagination from '../../components/Pagination/Pagination';
import usePlaces from '../../hooks/usePlaces';
import { categories, filterPlaces } from '../../utilities/placeFilters';
import { filterNearbyPlaces, getNearbyLocation, NEARBY_RADIUS_MILES } from '../../utilities/nearbyPlaces';
import { readMapBounds } from '../../utilities/mapBounds';
import { paginatePlaces } from '../../utilities/pagination';

const MapComponent = lazy(() => import('../../components/MapComponent/MapComponent'));
export default function Map() {
  const [params, setParams] = useSearchParams();
  const resultsRef = useRef(null);
  const query = params.get('q') || '';
  const category = params.get('category') || '';
  const { user } = useAuth();
  const preferredView = user?.user_metadata?.directory_view === 'map' ? 'map' : 'list';
  const view = params.has('view') ? (params.get('view') === 'map' ? 'map' : 'list') : preferredView;
  const { places, loading, error, retry } = usePlaces();
  const nearby = useMemo(() => getNearbyLocation(params), [params]);
  const boundsValue = params.get('bounds');
  const focusBounds = useMemo(() => readMapBounds(boundsValue), [boundsValue]);
  const filtered = useMemo(() => filterNearbyPlaces(filterPlaces(places, query, category), nearby), [places, query, category, nearby]);
  const pagination = paginatePlaces(filtered, params.get('page'));
  const changePage = page => {
    const next = new URLSearchParams(params);
    if (page > 1) next.set('page', String(page)); else next.delete('page');
    setParams(next);
    if (view === 'list') resultsRef.current?.scrollIntoView({ block: 'start' });
  };
  const clearNearby = () => {
    const next = new URLSearchParams(params);
    next.delete('lat'); next.delete('lng'); next.delete('page');
    setParams(next, { replace: true });
  };
  const showAllPlaces = () => {
    const next = new URLSearchParams(params);
    next.delete('category'); next.delete('lat'); next.delete('lng'); next.delete('bounds'); next.delete('page');
    setParams(next, { replace: true });
  };
  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'view') next.delete('page');
    setParams(next, { replace: true });
  };
  return <main id="main-content" className={`${styles.directory} ${view === 'map' ? styles.mapDirectory : ''}`}>
    <Helmet><title>Explore Places | Little Herb Places</title></Helmet>
    <h1>Somewhere Good Is Growing.</h1>
    <p className={styles.intro}>Find independent herb shops, plant people, and spaces to put down roots.</p>
    <PlaceSearch id="directory-search" className={styles.directorySearch} value={query} onChange={value => update('q', value)} onSubmit={event => event.preventDefault()} />
    <p className={styles.intro}><Link to="/browse">Browse by city</Link> · Can’t find your place? <Link to="/request-place">Request a Listing</Link>.</p>
    {nearby && <div className={styles.nearbyFilter}><p role="status">Showing places within {NEARBY_RADIUS_MILES} miles of your location.</p><button className="button" onClick={clearNearby}>Show Places Everywhere</button></div>}
    <div className={styles.filterHeading}><span id="category-label">Kind of place</span>{(query || category || nearby) && <button className={styles.clearFilters} onClick={() => setParams({ view })}>Clear Filters</button>}</div>
    <div className={styles.filters} role="group" aria-labelledby="category-label"><button className="button" aria-pressed={!category && !nearby} onClick={showAllPlaces}><Icon name="places" size={24} />All Places</button><NearbyPlaces />{categories.map(item => <button className="button" key={item.id} aria-pressed={category === item.id} onClick={() => update('category', item.id)}><Icon name={item.icon} size={24} />{item.short}</button>)}</div>
    <div className={styles.results}><p role="status" aria-live="polite">{loading ? 'Gathering little places…' : error ? 'Places are taking a little longer to grow.' : `${filtered.length} ${filtered.length === 1 ? 'place' : 'places'} to discover`}</p><div className={styles.views} role="group" aria-label="Directory view"><button className="button" aria-pressed={view === 'list'} onClick={() => update('view', 'list')}><Icon name="grid" size={16} /> List</button><button className="button" aria-pressed={view === 'map'} onClick={() => update('view', 'map')}><Icon name="map" size={16} /> Map</button></div></div>
    {loading ? <div className={styles.status} role="status">Gathering little places…</div> : error ? <div className={styles.status} role="status"><Icon name="sprout" size={32} /><h2>A Little Pause in the Garden.</h2><p>{error}</p><button className="button" onClick={retry}>Try Again <Icon name="arrow" size={16} /></button></div> : view === 'list' ? <section ref={resultsRef} aria-label="Places results"><ListComponent places={pagination.items} /><Pagination {...pagination} onChange={changePage} /></section> : <Suspense fallback={<div className={styles.status} role="status">Opening the map…</div>}><MapComponent places={filtered} nearby={nearby} onClearNearby={clearNearby} selectedPlaceId={params.get('place')} focusBounds={focusBounds} pageValue={params.get('page')} onPageChange={changePage} /></Suspense>}
  </main>;
}
