import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import supabase from '../../utilities/supabase';
import styles from "./place.module.scss";
import { Helmet } from "react-helmet";

export default function Place() {
  const { slug } = useParams();
  const [place, setPlace] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    const fetchPlace = async () => {
      try {
        const { data, error } = await supabase
          .from('places')
          .select('*')
          .eq('urlSlug', slug)
          .single();

        if (error) throw error;
        if (data) setPlace(data);
      } catch (err) {
        console.error('Error fetching place:', err);
      }
    };

    fetchPlace();
  }, [slug]);

  const handleScroll = (e) => {
    const scrollPosition = e.target.scrollLeft;
    const photoWidth = e.target.offsetWidth;
    const newIndex = Math.round(scrollPosition / photoWidth);
    setCurrentPhotoIndex(newIndex);
  };

  const scrollToPhoto = (index) => {
    const gallery = document.querySelector(`.${styles.photoGallery}`);
    const photoWidth = gallery.offsetWidth;
    gallery.scrollTo({
      left: photoWidth * index,
      behavior: 'smooth'
    });
    setCurrentPhotoIndex(index);
  };

  const handlePrev = () => {
    const newIndex = currentPhotoIndex > 0 ? currentPhotoIndex - 1 : place.photos.length - 1;
    scrollToPhoto(newIndex);
  };

  const handleNext = () => {
    const newIndex = currentPhotoIndex < place.photos.length - 1 ? currentPhotoIndex + 1 : 0;
    scrollToPhoto(newIndex);
  };

  if (!place) return <p>Loading...</p>;

  return (
    <>
      <Helmet>
        <title>{place.name} in {place.city}, {place.state} | Little Herb Places</title>
      </Helmet>
      <div className={styles.wrapper}>
        <h1>{place.name}</h1>
        <h2>{place.tagline}</h2>

        <ul className={styles.metaNav}>
          <li>
            <a
              target="_blank"
              href={`https://maps.google.com/?q=${encodeURIComponent(`${place.address} ${place.city}, ${place.state}`)}`}
              onClick={(e) => {
                e.preventDefault();
                // Try Apple Maps first (iOS)
                window.location.href = `maps://maps.apple.com/?q=${encodeURIComponent(`${place.address} ${place.city}, ${place.state}`)}`;

                // Check if Apple Maps failed to open after a short delay
                const start = Date.now();
                const checkFallback = () => {
                  if (Date.now() - start > 100 && !document.hidden) {
                    // Fallback to Google Maps if Apple Maps didn't open
                    window.location.href = `https://maps.google.com/?q=${encodeURIComponent(`${place.address} ${place.city}, ${place.state}`)}`;
                  } else {
                    requestAnimationFrame(checkFallback);
                  }
                };
                checkFallback();
              }}
            >
              <svg width="16px" height="16.0016895px" viewBox="0 0 16 16.0016895" version="1.1" xmlns="http://www.w3.org/2000/svg">
                <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                  <g transform="translate(-33.25, -205.2492)" fill="#000000" fillRule="nonzero">
                    <g transform="translate(33.25, 205.2492)">
                      <path d="M5.27883787,0.000555629958 C5.29103173,0.00128129159 5.30370847,0.00211129831 5.31641407,0.00327496262 C5.37854859,0.00858822015 5.43916468,0.021990548 5.49703301,0.0423633115 L10.722,1.942 L14.9453962,0.0654860926 C15.4413617,-0.15494304 16,0.208100959 16,0.750844754 L16,13.2508448 C16,13.5472363 15.8254499,13.8158274 15.5546038,13.9362034 L11.0612886,15.9333746 C11.0304898,15.9475036 10.9986821,15.9595891 10.966075,15.9694847 L11.0546038,15.9362034 C11.0164276,15.9531707 10.9778799,15.9666809 10.9392443,15.9769181 C10.9174294,15.9828585 10.8942215,15.987839 10.8707264,15.9917032 C10.8516539,15.9948538 10.832472,15.9972731 10.8133444,15.9989336 C10.8038216,15.9996614 10.7940295,16.0003007 10.7842036,16.0007446 C10.6821428,16.0056635 10.5821947,15.9890454 10.4896368,15.954492 L5.278,14.059 L1.05460385,15.9362034 C0.558638302,16.1566325 0,15.7935885 0,15.2508448 L0,2.75084475 C0,2.45445322 0.174550141,2.1858621 0.44539615,2.06548609 L4.93871135,0.0683148856 C4.99140348,0.0450383902 5.03795011,0.0296114761 5.08454009,0.0188830474 C5.09882534,0.0154865145 5.11398869,0.012500169 5.12927364,0.00998632093 C5.14834609,0.00683571099 5.16752799,0.00441640738 5.18665558,0.00275587127 C5.19617836,0.00202812438 5.20597047,0.00138876214 5.21579639,0.00094495203 L5.27883787,0.000555629958 Z M6,1.82084475 L6,12.7258448 L10,14.1798448 L10,3.27584475 L6,1.82084475 Z M4.5,1.90384475 L1.5,3.23784475 L1.5,14.0958448 L4.5,12.7628448 L4.5,1.90384475 Z M14.5,1.90384475 L11.5,3.23784475 L11.5,14.0958448 L14.5,12.7628448 L14.5,1.90384475 Z" id="Combined-Shape"></path>
                    </g>
                  </g>
                </g>
              </svg>
              <span>{place.address}<br />{place.city}, {place.state} {place.zip}</span>
            </a>
          </li>
          <li>
            <a
              target="_blank"
              href={place.website}>
              <svg width="12px" height="12px" viewBox="0 0 12 12">
                <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd" strokeLinecap="round" strokeLinejoin="round">
                  <g transform="translate(-193.25, -207.25)" stroke="#000000" strokeWidth="1.5">
                    <g transform="translate(194, 208)">
                      <path d="M10.5,8.5 L10.5,0 L2,0 M10.25,0.25 L0,10.5" ></path>
                    </g>
                  </g>
                </g>
              </svg>
              {place.website.replace(/(https?:\/\/)?(www\.)?/i, '').replace(/\/$/, '')}
            </a>
          </li>
        </ul>

        {place.photos && place.photos.length > 0 && (
          <div className={styles.photoContainer}>
            <button
              className={`${styles.navButton} ${styles.prev}`}
              onClick={handlePrev}
              aria-label="Previous photo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              className={`${styles.navButton} ${styles.next}`}
              onClick={handleNext}
              aria-label="Next photo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <div className={styles.photoGallery} onScroll={handleScroll}>
              {place.photos.map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`${place.name} - Photo ${index + 1}`}
                  className={styles.galleryPhoto}
                />
              ))}
            </div>
            <div className={styles.dotsContainer}>
              {place.photos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollToPhoto(index)}
                  className={`${styles.dot} ${currentPhotoIndex === index ? styles.active : ''}`}
                  aria-label={`View photo ${index + 1}`}
                />
              ))}
            </div>
          </div>
        )
}

{
  place.description.split('\n').map((paragraph, index) => (
    <p key={index}>{paragraph}</p>
  ))
}


      </div >
    </>
  );
}