import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styles from "./list.module.scss";
import fetchPlaces from '../../utilities/fetchPlaces';

const ListComponent = () => {

  const [places, setPlaces] = useState([]);

  useEffect(() => {
    async function loadPlaces() {
      const data = await fetchPlaces();
      setPlaces(data || []); // Handle null or empty data
    }

    loadPlaces();
  }, []);

  return (
    <div className={styles.places}>
      {places.map((place) => (
        <Link
          to={`/place/${place.urlSlug}`}
          className={styles.place}
          key={place.id}
        >
          <img 
            className={styles.coverPhoto} 
            src={place.coverPhoto} 
            alt={place.name} 
          />
          <div className={styles.meta}>
            <h3>{place.name}</h3>
            <p>{place.tagline}</p>
            <p className={styles.location}>
              {place.city}, {place.state}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default ListComponent;