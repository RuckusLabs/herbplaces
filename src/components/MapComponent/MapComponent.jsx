import { useState, useEffect, useRef } from 'react';
import Map, { Marker, Popup } from 'react-map-gl';
import styles from "./map.module.scss";
import modalStyles from "./modal.module.scss";
import fetchPlaces from '../../utilities/fetchPlaces';

const MAPBOX_TOKEN = "pk.eyJ1IjoibmV3bmVzc3BvaXNlIiwiYSI6ImNtNDd3a3h5dTBhZnIybXB6a2xiaWp6dmYifQ.dkGpXraTqTxcS2Jl1w7Qaw";

const MapComponent = () => {

  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const mapRef = useRef(null); // Reference for the map instance

  useEffect(() => {
    async function loadPlaces() {
      const data = await fetchPlaces();
      setPlaces(data || []); // Handle null or empty data
    }

    loadPlaces();
  }, []);

  const initialViewState = {
    longitude: -107.70888,
    latitude: 33.49152,
    zoom: window.innerWidth <= 768 ? 3 : 5,
  };

  const handlePopupClick = (place) => {
    // Navigate to the place's page
    window.location.href = `/place/${place.urlSlug}`;
  }

  const handleMarkerClick = (place) => {
    // Only set selected place if it's different from the current one
    if (!selectedPlace || selectedPlace.id !== place.id) {
      setSelectedPlace(place);
      
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [place.longitude, place.latitude],
          zoom: 15,
          speed: 3,
          curve: 1,
          easing: (t) => t,
        });
      }
    }
  };

  const handleMapClick = (e) => {
    // Only zoom out if clicking on the map itself, not on a marker or popup
    if (mapRef.current && selectedPlace && !e.originalEvent.target.closest('.mapboxgl-popup') && !e.originalEvent.target.closest(`.${styles.marker}`)) {
      mapRef.current.flyTo({
        center: [initialViewState.longitude, initialViewState.latitude],
        zoom: initialViewState.zoom,
        speed: 2,
        curve: 1,
        easing: (t) => t,
      });
      setSelectedPlace(null);
    }
  };

  return (
    <div className={styles.mapContainer}>
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/newnesspoise/cm47x04wk00y301qrc1luaz4n"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        onClick={handleMapClick}
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            longitude={place.longitude}
            latitude={place.latitude}
          >
            <div className={styles.marker} onClick={() => handleMarkerClick(place)} />
          </Marker>
        ))}

        {selectedPlace && (
          <Popup
            longitude={selectedPlace.longitude}
            latitude={selectedPlace.latitude}
            closeButton={false}
            closeOnClick={false}
            onClose={() => setSelectedPlace(null)}
            anchor="bottom"
            className={modalStyles.popup}
          >
            <div onClick={() => handlePopupClick(selectedPlace)} style={{ cursor: 'pointer' }}>
              <div className={modalStyles.coverPhotoContainer}>
                <img src={selectedPlace.coverPhoto} alt={selectedPlace.name} />
              </div>
              <p className={modalStyles.placeName}>{selectedPlace.name}</p>
              <p>{selectedPlace.address}</p>
              <p>{selectedPlace.city}, {selectedPlace.state} {selectedPlace.zip}</p>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}

export default MapComponent;