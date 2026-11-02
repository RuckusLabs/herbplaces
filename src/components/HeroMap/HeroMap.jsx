import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Marker } from 'react-map-gl/maplibre';
import Icon from '../Icons/Icon';
import MapPlacePin from '../MapPlacePin/MapPlacePin';
import FreeMap from '../FreeMap/FreeMap';
import usePlaces from '../../hooks/usePlaces';
import { getHeroMapLayout, getHeroMapGroups } from '../../utilities/heroMap';
import { getMapBounds } from '../../utilities/mapBounds';
import styles from './heroMap.module.scss';

const accessibleMarker = marker => {
  if (marker) { marker.getElement().setAttribute('role', 'presentation'); marker.getElement().removeAttribute('aria-label'); }
};

export default function HeroMap() {
  const container = useRef(null);
  const mapRef = useRef(null);
  const [size, setSize] = useState(null);
  const [camera, setCamera] = useState(null);
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

  // Keep production's opening overview; native markers follow the camera.
  const layout = useMemo(() => size?.width > 0 && size?.height > 0 && getHeroMapLayout(places, size.width, size.height, size.mobile), [places, size]);

  const groups = useMemo(() => !layout ? [] : camera ? getHeroMapGroups(places, size.width, size.height, camera, size.mobile) : layout.groups, [places, size, layout, camera]);

  const zoomBy = (delta, event) => {
    const map = mapRef.current;
    if (!map || !size) return;
    const focusX = size.mobile ? size.width / 2 : (size.width * .48 + size.width - 90) / 2;
    map.zoomTo(Math.max(0, Math.min(18, map.getZoom() + delta)), {
      around: map.unproject([focusX, size.height / 2]),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
    }, { originalEvent: event.nativeEvent });
  };

  const reset = () => {
    mapRef.current?.stop();
    setCamera(null);
    mapRef.current?.jumpTo({ center: [layout.longitude, layout.latitude], zoom: layout.zoom });
  };

  return <div className={styles.scene}>
    <div ref={container} className={styles.map} role="region" aria-label="Explore Little Herb Places on the Map">
      {!ready && <img className={styles.photo} src="/assets/pages/home/hero.jpg" alt="" width="900" height="1350" decoding="async" />}
      {layout && !loading && !error && <div className={styles.basemap} role="group" aria-label="Explore little places">
        <FreeMap ref={mapRef} longitude={camera?.longitude ?? layout.longitude} latitude={camera?.latitude ?? layout.latitude} zoom={camera?.zoom ?? layout.zoom} pitch={0} bearing={0}
          renderWorldCopies cooperativeGestures touchPitch={false} dragRotate={false} attributionControl={false}
          onMove={event => { if (event.originalEvent) setCamera({ longitude: event.viewState.longitude, latitude: event.viewState.latitude, zoom: event.viewState.zoom }); }}
          onFailure={failMap} onLoad={() => setReady(true)} style={{ width: '100%', height: '100%' }}>
          {ready && groups.map(item => {
            const place = item.places[0];
            const grouped = item.places.length > 1;
            const destination = grouped ? `/map?${new URLSearchParams({ view: 'map', bounds: getMapBounds(item.places).flat().join(',') })}` : `/place/${place.urlSlug}`;
            return <Marker ref={accessibleMarker} key={place.id} longitude={Number(place.longitude)} latitude={Number(place.latitude)} anchor="bottom">
              <MapPlacePin place={place} count={item.places.length} ariaLabel={grouped ? `Explore ${item.places.length} places in this area` : `Visit ${place.name}`} onClick={event => { event.stopPropagation(); navigate(destination); }} />
            </Marker>;
          })}
        </FreeMap>
      </div>}
      {ready && !error && <div className={styles.zoomControls} role="group" aria-label="Map Zoom">
        <button aria-label="Zoom in" onClick={event => zoomBy(1, event)}>+</button>
        <button aria-label="Zoom out" onClick={event => zoomBy(-1, event)}>−</button>
      </div>}
      {!ready && <div className={styles.wash} />}
      {ready && !error && <div className={styles.attribution}><span><a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> · Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></span></div>}
    </div>
    {ready && !error && camera && <button className={styles.reset} onClick={reset}>Reset Map</button>}
    <Link className={`button ${styles.openMap}`} to={error ? '/map' : '/map?view=map'}><Icon name={error ? 'places' : 'expand'} size={17} />{error ? 'Explore the Directory' : 'Open the Full Map'}</Link>
  </div>;
}
