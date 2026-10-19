import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icons/Icon';
import MapPlacePreview from '../MapPlacePreview/MapPlacePreview';
import MapPlacePin from '../MapPlacePin/MapPlacePin';
import usePlaces from '../../hooks/usePlaces';
import { getHeroMapView } from '../../utilities/heroMap';
import { MAPBOX_TOKEN } from '../../utilities/mapConfig';
import styles from './heroMap.module.scss';

export default function HeroMap() {
  const container = useRef(null);
  const [size, setSize] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [imageError, setImageError] = useState(false);
  const { places, loading, error } = usePlaces();

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
  const group = layout?.groups.find(item => item.places.some(place => String(place.id) === selectedId)) || layout?.groups[0];
  const selected = group?.places.find(place => String(place.id) === selectedId) || group?.places[0];
  const mapUrl = MAPBOX_TOKEN && layout && !loading && `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${layout.longitude},${layout.latitude},${layout.zoom},0/${layout.imageWidth}x${layout.imageHeight}@2x?access_token=${MAPBOX_TOKEN}&logo=false&attribution=false`;

  return <div className={styles.scene}>
    <div ref={container} className={styles.map}>
      {mapUrl && !imageError && <img key={mapUrl} className={styles.basemap} src={mapUrl} alt="" width={size.width} height={size.height} loading="eager" decoding="async" onError={() => setImageError(true)} />}
      <div className={styles.wash} />
      <div className={styles.pins} role="group" aria-label="Preview places on the map">
        {layout?.groups.map(item => {
          const place = item.places[0];
          const active = item === group;
          return <MapPlacePin key={place.id} place={active ? selected : place} count={item.places.length} selected={active} style={{ position: 'absolute', left: item.x, top: item.y, transform: 'translate(-50%, -100%)' }} ariaLabel={`Preview ${item.places.length > 1 ? `${item.places.length} places, including ${place.name}` : place.name}`} ariaControls="hero-place-preview" onClick={() => setSelectedId(String(place.id))} />;
        })}
      </div>
      <div className={styles.attribution}><a href="https://www.mapbox.com/" target="_blank" rel="noopener noreferrer" aria-label="Mapbox maps"><img src="/assets/maps/mapbox-logo.svg" width="88" height="23" alt="Mapbox" /></a><span>© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · <a href="https://apps.mapbox.com/feedback/" target="_blank" rel="noopener noreferrer">Improve This Map</a></span></div>
    </div>
    <div className={styles.previewWrap}>
      {selected ? <MapPlacePreview id="hero-place-preview" place={selected} nearbyPlaces={group.places} onSelect={place => setSelectedId(String(place.id))} /> : <div className={styles.previewPlaceholder} role="status"><Icon name="sprout" size={36} /><p>{loading ? 'Finding a Few Little Places…' : error ? 'There’s Somewhere Good to Discover.' : 'More Little Places Are Growing.'}</p><Link to="/map?view=map" className="button">Explore the Map</Link></div>}
      <Link className={`button ${styles.openMap}`} to="/map?view=map"><Icon name="expand" size={17} />Open the Full Map</Link>
    </div>
  </div>;
}
