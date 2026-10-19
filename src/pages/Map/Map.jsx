import { Helmet } from 'react-helmet';
import { lazy, Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import styles from './map.module.scss';
import ListComponent from '../../components/List/List';
import Icon from '../../components/Icons/Icon';
import PlaceSearch from '../../components/PlaceSearch/PlaceSearch';
import usePlaces from '../../hooks/usePlaces';
import { categories, filterPlaces } from '../../utilities/placeFilters';

const MapComponent = lazy(() => import('../../components/MapComponent/MapComponent'));
export default function Map() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const category = params.get('category') || '';
  const view = params.get('view') === 'map' ? 'map' : 'list';
  const { places, loading, error, retry } = usePlaces();
  const filtered = useMemo(() => filterPlaces(places, query, category), [places, query, category]);
  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };
  return <main id="main-content" className={`${styles.directory} ${view === 'map' ? styles.mapDirectory : ''}`}>
    <Helmet><title>Explore Places | Little Herb Places</title></Helmet>
    <h1>Somewhere Good Is Growing.</h1>
    <p className={styles.intro}>Find independent herb shops, plant people, and spaces to put down roots.</p>
    <PlaceSearch id="directory-search" className={styles.directorySearch} value={query} onChange={value => update('q', value)} onSubmit={event => event.preventDefault()} />
    <div className={styles.filterHeading}><span id="category-label">Kind of place</span>{(query || category) && <button className={styles.clearFilters} onClick={() => setParams(view === 'map' ? { view: 'map' } : {})}>Clear Filters</button>}</div>
    <div className={styles.filters} role="group" aria-labelledby="category-label"><button className="button" aria-pressed={!category} onClick={() => update('category', '')}><Icon name="places" size={24} />All Places</button>{categories.map(item => <button className="button" key={item.id} aria-pressed={category === item.id} onClick={() => update('category', item.id)}><Icon name={item.icon} size={24} />{item.short}</button>)}</div>
    <div className={styles.results}><p role="status" aria-live="polite">{loading ? 'Gathering little places…' : error ? 'Places are taking a little longer to grow.' : `${filtered.length} ${filtered.length === 1 ? 'place' : 'places'} to discover`}</p><div className={styles.views} role="group" aria-label="Directory view"><button className="button" aria-pressed={view === 'list'} onClick={() => update('view', '')}><Icon name="grid" size={16} /> List</button><button className="button" aria-pressed={view === 'map'} onClick={() => update('view', 'map')}><Icon name="map" size={16} /> Map</button></div></div>
    {loading ? <div className={styles.status} role="status">Gathering little places…</div> : error ? <div className={styles.status} role="status"><Icon name="sprout" size={32} /><h2>A Little Pause in the Garden.</h2><p>{error}</p><button className="button" onClick={retry}>Try Again <Icon name="arrow" size={16} /></button></div> : view === 'list' ? <ListComponent places={filtered} /> : <Suspense fallback={<div className={styles.status} role="status">Opening the map…</div>}><MapComponent places={filtered} /></Suspense>}
  </main>;
}
