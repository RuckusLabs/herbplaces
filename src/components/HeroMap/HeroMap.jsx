import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../Icons/Icon';
import MapPlacePin from '../MapPlacePin/MapPlacePin';
import usePlaces from '../../hooks/usePlaces';
import { getHeroMapView } from '../../utilities/heroMap';
import { getMapBounds } from '../../utilities/mapBounds';
import { MAPBOX_TOKEN } from '../../utilities/mapConfig';
import styles from './heroMap.module.scss';

export default function HeroMap() {
  const container = useRef(null);
  const [size, setSize] = useState(null);
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
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

  const layout = useMemo(() => size && getHeroMapView(places, size.width, size.height, size.mobile), [places, size]);
  const mapUrl = MAPBOX_TOKEN && layout && !loading && `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${layout.longitude},${layout.latitude},${layout.zoom},0/${layout.imageWidth}x${layout.imageHeight}@2x?access_token=${MAPBOX_TOKEN}&logo=false&attribution=false`;

  return <div className={styles.scene}>
    <div ref={container} className={styles.map}>
      {mapUrl && !imageError && <img key={mapUrl} className={styles.basemap} src={mapUrl} alt="" width={size.width} height={size.height} loading="eager" decoding="async" onError={() => setImageError(true)} />}
      <div className={styles.wash} />
      <div className={styles.pins} role="group" aria-label="Explore little places">
        {layout?.groups.map(item => {
          const place = item.places[0];
          const grouped = item.places.length > 1;
          const destination = grouped ? `/map?${new URLSearchParams({ view: 'map', bounds: getMapBounds(item.places).flat().join(',') })}` : `/place/${place.urlSlug}`;
          return <MapPlacePin key={place.id} place={place} count={item.places.length} style={{ position: 'absolute', left: item.x, top: item.y, transform: 'translate(-50%, -100%)' }} ariaLabel={grouped ? `Explore ${item.places.length} places in this area` : `Visit ${place.name}`} onClick={() => navigate(destination)} />;
        })}
      </div>
      <div className={styles.attribution}><a href="https://www.mapbox.com/" target="_blank" rel="noopener noreferrer" aria-label="Mapbox maps"><img src="/assets/maps/mapbox-logo.svg" width="88" height="23" alt="Mapbox" /></a><span>© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · <a href="https://apps.mapbox.com/feedback/" target="_blank" rel="noopener noreferrer">Improve This Map</a></span></div>
    </div>
    <Link className={`button ${styles.openMap}`} to="/map?view=map"><Icon name="expand" size={17} />Open the Full Map</Link>
  </div>;
}
