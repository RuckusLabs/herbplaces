import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import MapCanvas, { Marker, Popup, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import styles from './map.module.scss';
import modalStyles from './modal.module.scss';
import MapPlacePreview from '../MapPlacePreview/MapPlacePreview';
import MapPlacePin from '../MapPlacePin/MapPlacePin';
import Icon from '../Icons/Icon';
import { getMapPlaces, getMapBounds, getPlacesInBounds, createPlaceIndex } from '../../utilities/mapPlaces';
import { MAPBOX_TOKEN } from '../../utilities/mapConfig';

const accessibleMarker = marker => { if (marker) { marker.getElement().setAttribute('role', 'presentation'); marker.getElement().removeAttribute('aria-label'); } };
const duration = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
const readBounds = map => { const bounds = map.getBounds(); return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]; };

export default function MapComponent({ places }) {
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [area, setArea] = useState(null);
  const [viewport, setViewport] = useState({ bounds: [-180, -85, 180, 85], zoom: 0 });
  const mapRef = useRef(null);
  const closePreviewRef = useRef(null);
  const listRefs = useRef(new Map());
  const coordinates = useMemo(() => getMapPlaces(places), [places]);
  const initial = useRef({ bounds: getMapBounds(coordinates) || [[-125, 25], [-66, 49]], fitBoundsOptions: { padding: 65, maxZoom: 12 } });
  const visible = useMemo(() => getPlacesInBounds(coordinates, area), [coordinates, area]);
  const index = useMemo(() => createPlaceIndex(visible), [visible]);
  const clusters = useMemo(() => index.getClusters(viewport.bounds, Math.floor(viewport.zoom)), [index, viewport]);
  const selected = coordinates.find(place => String(place.id) === selectedId);
  const byId = useMemo(() => new Map(coordinates.map(place => [String(place.id), place])), [coordinates]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const change = () => setMobile(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (selectedId && !visible.some(place => String(place.id) === selectedId)) setSelectedId(null);
  }, [visible, selectedId]);

  useEffect(() => { if (selectedId && mobile) closePreviewRef.current?.focus({ preventScroll: true }); }, [selectedId, mobile]);
  const closePreview = () => { setSelectedId(null); mapRef.current?.getCanvas().focus({ preventScroll: true }); };

  const updateViewport = () => {
    const map = mapRef.current;
    if (map) setViewport({ bounds: readBounds(map), zoom: map.getZoom() });
  };
  const select = place => {
    const id = String(place.id);
    setSelectedId(id);
    if (mobile) setBrowseOpen(false);
    mapRef.current?.flyTo({ center: [Number(place.longitude), Number(place.latitude)], zoom: Math.max(12, mapRef.current.getZoom()), offset: mobile ? [0, -100] : [0, 110], duration: duration() });
    if (!mobile && listRefs.current.get(id)) {
      const row = listRefs.current.get(id);
      row.parentElement.scrollTo({ top: row.offsetTop - 8, behavior: duration() ? 'smooth' : 'instant' });
    }
    if (mobile) mapRef.current?.getContainer().scrollIntoView({ block: 'center', behavior: duration() ? 'smooth' : 'instant' });
  };
  const showAll = () => {
    setArea(null);
    setSelectedId(null);
    const bounds = getMapBounds(coordinates);
    if (bounds) mapRef.current?.fitBounds(bounds, { padding: mobile ? 50 : 65, maxZoom: 12, duration: duration() });
  };
  const preview = selected && <MapPlacePreview id="discover-place-preview" place={selected} onClose={closePreview} closeButtonRef={closePreviewRef} showSave />;

  return <section className={styles.explorer} aria-label="Explore places on the map">
    <div className={styles.mapActions}>
      <div><button className="button" disabled={!ready || error} onClick={() => setArea(readBounds(mapRef.current))}>Search This Area</button><button className="button" disabled={!ready || error} onClick={showAll}>Show All Places</button></div>
    </div>
    <div className={styles.mapLayout}>
      <aside className={`${styles.resultsPanel} ${browseOpen ? styles.browseOpen : ''}`} aria-label="Map results">
        <button className={`button ${styles.browseToggle}`} aria-expanded={browseOpen} onClick={() => setBrowseOpen(open => !open)}>{browseOpen ? 'Hide' : 'Browse'} {visible.length} {visible.length === 1 ? 'Place' : 'Places'} <Icon name="grid" size={16} /></button>
        <div className={styles.resultList}>
          {!visible.length && <div className={styles.empty}><Icon name="sprout" size={48} /><h2>A Little Further Afield?</h2><p>Try another area or adjust your filters to find more places.</p></div>}
          {visible.map(place => <div ref={element => { if (element) listRefs.current.set(String(place.id), element); else listRefs.current.delete(String(place.id)); }} key={place.id} className={`${styles.result} ${selectedId === String(place.id) ? styles.selectedResult : ''}`}>
            <button className={`button ${styles.showOnMap}`} aria-pressed={selectedId === String(place.id)} onClick={() => select(place)}>Show {place.name} on Map <Icon name="pin" size={18} /></button>
            <MapPlacePreview place={place} showSave />
          </div>)}
        </div>
      </aside>
      <div className={styles.mapPanel}>
        {error ? <div className={styles.error} role="status"><h2>A Little Trouble Finding Our Way.</h2><p>The map couldn’t load. You can still explore every place in the results list.</p><button className="button" onClick={() => { setError(false); setReady(false); }}>Try the Map Again</button></div> : <MapCanvas ref={mapRef} initialViewState={initial.current} mapStyle="mapbox://styles/mapbox/light-v11" mapboxAccessToken={MAPBOX_TOKEN} renderWorldCopies={false} cooperativeGestures onLoad={() => { setReady(true); updateViewport(); }} onMoveEnd={updateViewport} onResize={updateViewport} onError={event => { if (!event.target?.isStyleLoaded()) setError(true); }} style={{ width: '100%', height: '100%' }}>
          <NavigationControl position="top-right" />
          {clusters.map(feature => {
            const [longitude, latitude] = feature.geometry.coordinates;
            if (feature.properties.cluster) {
              const first = index.getLeaves(feature.properties.cluster_id, 1)[0];
              return <Marker ref={accessibleMarker} key={`cluster-${feature.properties.cluster_id}`} longitude={longitude} latitude={latitude} anchor="bottom" offset={[0, 7]}><MapPlacePin place={byId.get(first?.properties.placeId)} count={feature.properties.point_count} ariaLabel={`Zoom in to ${feature.properties.point_count} places`} onClick={event => { event.stopPropagation(); mapRef.current?.flyTo({ center: [longitude, latitude], zoom: index.getClusterExpansionZoom(feature.properties.cluster_id), duration: duration() }); }} /></Marker>;
            }
            const place = byId.get(feature.properties.placeId);
            if (!place || selectedId === String(place.id)) return null;
            return <Marker ref={accessibleMarker} key={place.id} longitude={longitude} latitude={latitude} anchor="bottom" offset={[0, 7]}><MapPlacePin place={place} labelOnHover ariaLabel={`View ${place.name} on Map`} ariaControls={selected ? 'discover-place-preview' : undefined} onClick={event => { event.stopPropagation(); select(place); }} /></Marker>;
          })}
          {selected && <Marker ref={accessibleMarker} longitude={Number(selected.longitude)} latitude={Number(selected.latitude)} anchor="bottom" offset={[0, 7]}><MapPlacePin place={selected} selected ariaLabel={`Selected: ${selected.name}`} ariaControls="discover-place-preview" onClick={() => select(selected)} /></Marker>}
          {selected && !mobile && <Popup longitude={Number(selected.longitude)} latitude={Number(selected.latitude)} closeOnClick={false} closeButton={false} onClose={() => setSelectedId(null)} anchor="bottom" offset={84} maxWidth="350px" className={modalStyles.popup}>{preview}</Popup>}
        </MapCanvas>}
        {ready && !error && !visible.length && <div className={styles.noPlaces} role="status"><h2>No Places Here Just Yet.</h2><p>{!places.length ? 'Try another search or category, or clear your filters.' : !coordinates.length ? 'These places don’t have map locations yet. Switch to List to explore them.' : 'Choose Show All Places, or try another area.'}</p></div>}
        {!ready && !error && <p className={styles.mapLoading} role="status">Opening the Map…</p>}
        {selected && mobile && <div className={styles.mobilePreview} role="region" aria-label={`Selected place: ${selected.name}`}>{preview}</div>}
      </div>
    </div>
    <p className={styles.mapHint}>Select a pin or a place to take a closer look. Pins with a number reveal more places as you zoom in.</p>
  </section>;
}
MapComponent.propTypes = { places: PropTypes.array.isRequired };
