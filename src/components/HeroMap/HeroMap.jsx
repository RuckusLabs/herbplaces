import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../Icons/Icon';
import MapPlacePin from '../MapPlacePin/MapPlacePin';
import FreeMap from '../FreeMap/FreeMap';
import usePlaces from '../../hooks/usePlaces';
import { regionName } from '../../utilities/browse';
import { getHeroMapLayout } from '../../utilities/heroMap';
import { getMapBounds } from '../../utilities/mapBounds';
import styles from './heroMap.module.scss';

export default function HeroMap() {
  const container = useRef(null);
  const mapRef = useRef(null);
  const [size, setSize] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const failMap = useCallback(() => { setError(true); setReady(false); }, []);
  const navigate = useNavigate();
  const { places, loading } = usePlaces();

  useEffect(() => {
    let timeout;
    const update = () => {
      const { width, height } = container.current.getBoundingClientRect();
      setSize(previous => previous?.width === Math.round(width) && previous?.height === Math.round(height) ? previous : { width: Math.round(width), height: Math.round(height), mobile: window.matchMedia('(max-width: 760px)').matches });
    };
    update();
    const observer = new ResizeObserver(() => { clearTimeout(timeout); timeout = setTimeout(update, 180); });
    observer.observe(container.current);
    return () => { observer.disconnect(); clearTimeout(timeout); };
  }, []);
  useEffect(() => { mapRef.current?.resize(); }, [size]);

  // Allow horizontal wrapping below: the camera is offset for the introduction,
  // and clamping it to one world would move the basemap away from the pins.
  const layout = useMemo(() => size?.width > 0 && size?.height > 0 && getHeroMapLayout(places, size.width, size.height, size.mobile), [places, size]);

  return <div className={styles.scene}>
    <div ref={container} className={styles.map}>
      {!ready && <img className={styles.photo} src="/assets/pages/home/hero.jpg" alt="" width="900" height="1350" decoding="async" />}
      {layout && !loading && !error && <div className={styles.basemap} aria-hidden="true" inert="">
        <FreeMap ref={mapRef} longitude={layout.longitude} latitude={layout.latitude} zoom={layout.zoom} pitch={0} bearing={0} interactive={false} renderWorldCopies attributionControl={false} onFailure={failMap} onLoad={event => { event.target.getCanvas().tabIndex = -1; setReady(true); }} style={{ width: '100%', height: '100%' }} />
      </div>}
      <div className={styles.wash} />
      {ready && !error && <>
        <div className={styles.pins} role="group" aria-label="Explore little places">
          {layout?.groups.map(item => {
            const place = item.places[0];
            const grouped = item.places.length > 1;
            const destination = grouped ? `/map?${new URLSearchParams({ view: 'map', bounds: getMapBounds(item.places).flat().join(',') })}` : `/place/${place.urlSlug}`;
            return <MapPlacePin key={place.id} place={place} count={item.places.length} compact labelOnHover label={grouped ? `${item.places.length} Places · ${place.city || regionName(place.state) || 'Nearby'}` : place.name} style={{ position: 'absolute', left: item.x, top: item.y, transform: 'translate(-50%, -100%)' }} ariaLabel={grouped ? `Explore ${item.places.length} places near ${[place.city,regionName(place.state)].filter(Boolean).join(', ') || 'this area'}` : `Visit ${place.name}`} onClick={() => navigate(destination)} />;
          })}
        </div>
        <div className={styles.attribution}><span><a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> · Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></span></div>
      </>}
    </div>
    <Link className={`button ${styles.openMap}`} to={error ? '/map' : '/map?view=map'}><Icon name={error ? 'places' : 'expand'} size={17} />{error ? 'Explore the Directory' : 'Open the Full Map'}</Link>
  </div>;
}
