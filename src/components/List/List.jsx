import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from "./list.module.scss";
import fetchPlaces from '../../utilities/fetchPlaces';

import LocationIcon from "/src/assets/location-icon.svg?react";
import Badge from "/src/assets/icons/badge.svg?react";
import FavoriteButton from '../FavoriteButton/FavoriteButton';
import { useAuth } from '../../contexts/AuthContext';

export default function ListComponent({ className = '', limit, places: propPlaces }) {
  const [places, setPlaces] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (propPlaces) {
      setPlaces(propPlaces);
    } else {
      async function loadPlaces() {
        const data = await fetchPlaces();
        setPlaces(data || []);
      }
      loadPlaces();
    }
  }, [propPlaces]);

  const displayedPlaces = limit ? places.slice(0, limit) : places;

  return (
    <div className={`${styles.places} ${className}`}>
      {displayedPlaces.map((place) => (
        <>
          <Link to={`/place/${place.urlSlug}`} className={styles.place} key={place.id}>
            <img
              className={styles.coverPhoto}
              src={place.coverPhoto}
              alt={place.name}
            />
            <div className={styles.meta}>
              <h3>
                {place.name}
                {place.isVerified && <Badge className={styles.badge} />}
                <FavoriteButton
                  className={styles.favorite}
                  itemId={place.id}
                  itemType="place"
                  size={22}
                />
              </h3>
              <p>{place.tagline}</p>
              <p className={styles.location}>
                <LocationIcon className={styles.locationIcon} /> {place.city}, {place.state}
              </p>
            </div>
          </Link>
        </>
      ))}
    </div>
  );
}