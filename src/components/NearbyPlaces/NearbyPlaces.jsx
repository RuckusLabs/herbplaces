import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Modal from '../Modal/Modal';
import Icon from '../Icons/Icon';
import { getNearbyLocation, NEARBY_RADIUS_MILES } from '../../utilities/nearbyPlaces';
import styles from './nearbyPlaces.module.scss';

export default function NearbyPlaces() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const onMapPage = pathname.replace(/\/+$/, '') === '/map';
  const selected = onMapPage && !!getNearbyLocation(new URLSearchParams(search));
  useEffect(() => () => { request.current++; }, []);
  const close = () => { request.current++; setOpen(false); setBusy(false); };
  const locate = (current = ++request.current) => {
    setError('');
    if (!navigator.geolocation) { setBusy(false); setError('Location isn’t available in this browser. You can still explore the map and search by city.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(position => {
      if (request.current !== current) return;
      const params = new URLSearchParams(onMapPage ? search : '');
      params.set('view', 'map');
      params.set('lat', position.coords.latitude.toFixed(3));
      params.set('lng', position.coords.longitude.toFixed(3));
      params.delete('place');
      params.delete('bounds');
      params.delete('page');
      close();
      navigate(`/map?${params}`);
    }, failure => {
      if (request.current !== current) return;
      setBusy(false);
      setError(failure.code === 1 ? 'Location access wasn’t allowed. You can allow it in your browser settings and try again, or explore the map and search by city.' : 'We couldn’t find your location. Try again, or explore the map and search by city.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };
  const begin = async () => {
    if (busy) return;
    setError('');
    if (selected) {
      const params = new URLSearchParams(search);
      params.delete('lat'); params.delete('lng'); params.delete('page');
      navigate(`/map?${params}`, { replace: true });
      return;
    }
    setBusy(true);
    const current = ++request.current;
    try {
      const permission = await navigator.permissions?.query({ name: 'geolocation' });
      if (current !== request.current) return;
      if (permission?.state === 'granted') { locate(current); return; }
    } catch { /* Browsers without permission checks still get the explanation first. */ }
    if (current !== request.current) return;
    setBusy(false);
    setOpen(true);
  };

  return <>
    <button type="button" className={`button ${styles.trigger}`} disabled={busy} aria-busy={busy} aria-pressed={selected} onClick={begin}><Icon name="nearby" size={24} />{busy && !open ? 'Finding Your Location…' : 'Places Near Me'}</button>
    {error && !open && <p role="alert" className={styles.inlineError}>{error} <Link to="/map?view=map">Explore the Map</Link></p>}
    <Modal open={open} onClose={close} labelledBy="nearby-title" describedBy="nearby-description" closeLabel="Close location prompt" contentClassName={styles.content}>
      <Icon name="pin" size={42} />
      <h2 id="nearby-title">A Little Closer to You.</h2>
      <p id="nearby-description">Your browser will ask to share your location. We’ll use it once to open the map with places within {NEARBY_RADIUS_MILES} miles of you. You can decline and keep browsing.</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" className="button" disabled={busy} onClick={() => locate()}>{busy ? 'Finding Your Location…' : 'Use My Location'}</button>
        {error && <Link className="button" to="/map?view=map" onClick={close}>Explore the Map</Link>}
        <button type="button" className={`button ${styles.cancel}`} onClick={close}>Keep Browsing</button>
      </div>
    </Modal>
  </>;
}
