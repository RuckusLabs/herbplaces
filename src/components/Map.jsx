import { useState, useEffect, useRef } from 'react';
import Map, { Marker, Popup } from 'react-map-gl';
import styles from "./map.module.css";
import modalStyles from "./modal.module.css";

// Supabase
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://qtpepsebztlremlhpxdt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cGVwc2VienRscmVtbGhweGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5MDM2MjQsImV4cCI6MjA1MjQ3OTYyNH0.VbPZKmqyesdQjiz21UlLnMNun9WepnnECQO9FEKaSLM';
const supabase = createClient(supabaseUrl, supabaseKey);

const fetchPlaces = async () => {

  let { data, error } = await supabase
    .from('places')
    .select('*')
    // .eq('isFeatured', "TRUE")

  if (error) {
    console.error('Error fetching data:', error);
  }
  return data || [];
};


//Icons
import Pin from "/assets/location-icon.svg";
import CloseIcon from "/assets/close-icon.svg";
import Globe from "/assets/globe-icon.svg";

const MAPBOX_TOKEN = "pk.eyJ1IjoibmV3bmVzc3BvaXNlIiwiYSI6ImNtNDd3a3h5dTBhZnIybXB6a2xiaWp6dmYifQ.dkGpXraTqTxcS2Jl1w7Qaw";

const HerbMap = () => {

  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
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
    setModalOpen(true);
    document.body.classList.add("no-scroll");
    setSelectedPlace(place);

    // Fly to the selected marker's location
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

  const handleMarkerClick = (place) => {

    setModalOpen(true);
    document.body.classList.add("no-scroll");
    setSelectedPlace(place);

    // Fly to the selected marker's location
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [place.longitude, place.latitude],
        zoom: 15,
        speed: 3,
        curve: 1,
        easing: (t) => t,
      });
    }
  };

  const closeModal = () => {
    setSelectedPlace(null)
    setModalOpen(false);
    document.body.classList.remove("no-scroll");

    // Reset the map position and zoom after closing the modal
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [initialViewState.longitude, initialViewState.latitude],
        zoom: initialViewState.zoom,
        speed: 5,
        curve: 1,
        easing: (t) => t,
      });
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.places}>
        {places.map((place) => (
          <div
            className={styles.place}
            key={place.id}
            onClick={() => handlePopupClick(place)}
          >
            <img className={styles.coverPhoto} src={place.coverPhoto} alt={place.name} />
            <div className={styles.meta}>
              <h3>{place.name}</h3>
              <p>{place.tagline}</p>
              <p className={styles.location}><img className={styles.pinIcon} src={Pin} alt="Location" /> {place.city}, {place.state}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.mapContainer}>
        <Map
          ref={mapRef}
          initialViewState={initialViewState}
          mapStyle="mapbox://styles/newnesspoise/cm47x04wk00y301qrc1luaz4n"
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ width: '100%', height: '100%' }}
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
              onClick={() => handleMarkerClick(selectedPlace)}
            >
              <div className={modalStyles.coverPhotoContainer}>
                <img src={selectedPlace.coverPhoto} alt={selectedPlace.name} />
              </div>
              <p className={modalStyles.placeName}>{selectedPlace.name}</p>
              <p>{selectedPlace.address}</p>
              <p>{selectedPlace.city}, {selectedPlace.state} {selectedPlace.zip} </p>
            </Popup>
          )}
        </Map>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <>
          <div className="overlay" onClick={closeModal}></div>
          <div className={modalStyles.modal}>
            <div className={modalStyles.modalContent}>
              <img className={modalStyles.closeIcon} src={CloseIcon} alt="Close modal." onClick={closeModal} />
              <h2>{selectedPlace?.name}</h2>
              <h3>{selectedPlace?.tagline}</h3>
              <p className={modalStyles.meta}><img className={modalStyles.globe} src={Globe} alt="Website." /><a target="_blank" href={selectedPlace?.website}>{selectedPlace?.website}</a></p>
              <p className={modalStyles.meta}><img className={modalStyles.pin} src={Pin} alt="Place location." />{selectedPlace?.address}<br />{selectedPlace?.city}, {selectedPlace?.state} {selectedPlace.zip}</p>
              <div className={modalStyles.description}>
                {selectedPlace?.description?.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
              <div className={modalStyles.carousel}>
                {selectedPlace?.photos?.map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    className={modalStyles.carouselImage}
                    alt={`Photo ${index + 1} of ${selectedPlace?.name}`}
                    style={{
                      width: "100%",
                      marginBottom: "25px",
                      borderRadius: "5px",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default HerbMap;