import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Marker, NavigationControl } from 'react-map-gl/maplibre';
import Icon from '../Icons/Icon';
import MapPlacePin from '../MapPlacePin/MapPlacePin';
import FreeMap from '../FreeMap/FreeMap';
import usePlaces from '../../hooks/usePlaces';
import { createPlaceIndex, getMapBounds } from '../../utilities/mapPlaces';
import { heroMapDestination, heroMapPlaces } from '../../utilities/heroMap';
import styles from './heroMap.module.scss';

const duration = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
const accessibleMarker = marker => {
  if (marker) { marker.getElement().setAttribute('role', 'presentation'); marker.getElement().removeAttribute('aria-label'); }
};

export default function HeroMap() {
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [exploring, setExploring] = useState(false);
  const [viewport, setViewport] = useState({ bounds: [-180, -85, 180, 85], zoom: 0 });
  const failMap = useCallback(() => { setError(true); setReady(false); }, []);
  const navigate = useNavigate();
  const { places, loading } = usePlaces();
  const located = useMemo(() => heroMapPlaces(places), [places]);
  const index = useMemo(() => createPlaceIndex(located), [located]);
  const byId = useMemo(() => new Map(located.map(place => [String(place.id), place])), [located]);
  const clusters = useMemo(() => index.getClusters(viewport.bounds, Math.floor(viewport.zoom)), [index, viewport]);
  const overview = useMemo(() => ({ bounds: getMapBounds(located) || [[-170, -55], [170, 75]], fitBoundsOptions: { padding: 55, maxZoom: 4 } }), [located]);
  useEffect(() => {
    if (ready && !exploring) mapRef.current?.fitBounds(overview.bounds, { ...overview.fitBoundsOptions, duration: 0 });
  }, [ready, exploring, overview]);
  const updateViewport = event => {
    const map = event.target;
    const bounds = map.getBounds();
    setViewport({ bounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()], zoom: map.getZoom() });
  };
  const reset = () => {
    setExploring(false);
  };

  return <div className={styles.scene}>
    <div className={styles.map} role="region" aria-label="Explore Little Herb Places Around the World">
      {!ready && <img className={styles.photo} src="/assets/pages/home/hero.jpg" alt="" width="900" height="1350" decoding="async" />}
      {!loading && !error && <div className={styles.basemap} role="group" aria-label="Explore little places">
        <FreeMap ref={mapRef} initialViewState={overview} renderWorldCopies={false} cooperativeGestures attributionControl={false} onFailure={failMap}
          onLoad={event => { setReady(true); updateViewport(event); }} onMoveStart={event => { if (event.originalEvent) setExploring(true); }} onMoveEnd={updateViewport} onResize={event => {
            if (ready && !exploring) event.target.fitBounds(overview.bounds, { ...overview.fitBoundsOptions, duration: 0 });
            updateViewport(event);
          }} style={{ width: '100%', height: '100%' }}>
          <NavigationControl position="top-right" showCompass={false} />
          {ready && <>
            {clusters.map(feature => {
              const [longitude, latitude] = feature.geometry.coordinates;
              if (feature.properties.cluster) {
                const id = feature.properties.cluster_id;
                const count = feature.properties.point_count;
                return <Marker ref={accessibleMarker} key={`cluster-${id}`} longitude={longitude} latitude={latitude} anchor="center">
                  <button className={styles.cluster} aria-label={`Zoom in to ${count} Little Herb Places`} onClick={event => {
                    event.stopPropagation(); setExploring(true);
                    mapRef.current?.flyTo({ center: [longitude, latitude], zoom: index.getClusterExpansionZoom(id), duration: duration() });
                  }}>{count}</button>
                </Marker>;
              }
              const place = byId.get(feature.properties.placeId);
              return place && <Marker ref={accessibleMarker} key={place.id} longitude={longitude} latitude={latitude} anchor="bottom">
                <MapPlacePin place={place} compact labelOnHover ariaLabel={`Visit ${place.name}`} onClick={event => { event.stopPropagation(); navigate(`/place/${place.urlSlug}`); }} />
              </Marker>;
            })}
          </>}
        </FreeMap>
      </div>}
      {ready && !error && <>
        <p className={styles.hint}>{located.length} Little Herb Places<span>Drag to explore · Select a number to zoom in</span></p>
        <div className={styles.attribution}><span><a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> · Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></span></div>
      </>}
    </div>
    <div className={styles.actions}>
      {ready && !error && exploring && <button className={styles.reset} onClick={reset}>Show All Places</button>}
      <Link className={`button ${styles.openMap}`} to={error ? '/map' : exploring ? heroMapDestination(viewport.bounds) : '/map?view=map'}><Icon name={error ? 'places' : 'expand'} size={17} />{error ? 'Explore the Directory' : exploring ? 'Explore This Area' : 'Open the Full Map'}</Link>
    </div>
  </div>;
}
