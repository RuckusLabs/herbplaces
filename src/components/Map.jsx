import { useState, useRef } from 'react';
import Map, { Marker, Popup } from 'react-map-gl';
import styles from "./map.module.css";
import modalStyles from "./modal.module.css";

//Icons
import Pin from "/assets/location-icon.svg";
import CloseIcon from "/assets/close-icon.svg";
import Globe from "/assets/globe-icon.svg";

const MAPBOX_TOKEN = "pk.eyJ1IjoibmV3bmVzc3BvaXNlIiwiYSI6ImNtNDd3a3h5dTBhZnIybXB6a2xiaWp6dmYifQ.dkGpXraTqTxcS2Jl1w7Qaw";

const HerbMap = () => {

  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const mapRef = useRef(null); // Reference for the map instance

  const initialViewState = {
    longitude: -107.70888,
    latitude: 33.49152,
    zoom: window.innerWidth <= 768 ? 3 : 5,
  };

  const handlePopupClick = (place) => {
    setModalOpen(true);
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

  const places = [
    {
      id: 1,
      name: "Bodega Loya",
      website: "https://gwsfarm.com/",
      address: "10257 Socorro Rd",
      city: "Socorro",
      state: "Texas",
      zip: "79927",
      description: "Nestled in the vibrant city of El Paso, Bodega Loya is a delightful oasis that will captivate your senses and warm your heart. As you enter this enchanting space, you’ll discover a cozy coffee shop, an inspiring art area, and beautifully crafted leather designs, all within a family-owned farm and market dedicated to serving the community. \nBodega Loya offers an abundance of organic herbs, vegetables, and fruits, creating a feast for your senses with the intoxicating aromas of rosemary, calendula, and fresh watermelon. You’ll feel an instant connection to the land as you explore the back farm and garden, where you can watch the family lovingly harvest fresh produce for your next meal. \nThis charming destination is a must- visit while traveling through Texas, ensuring you leave with not just fresh ingredients but also a heart full of warmth and joy. \nWhether you’re stopping by for a cup of coffee or to pick up some farm - fresh goodies, Bodega Loya promises an unforgettable experience that will truly make your heart melt!",
      tagline: "A Charming Herb Farm Experience",
      coverPhoto: "/assets/places/bodega-loya-cover.jpg",
      photos: [
        "/assets/places/bodega-loya-1.png",
        "/assets/places/bodega-loya-2.png"
      ],
      longitude: -106.30,
      latitude: 31.65
    },
    {
      id: 2,
      name: "The Herb Bar",
      website: "https://www.theherbbar.com/",
      address: "200 W Mary St",
      city: "Austin",
      state: "Texas",
      zip: "78704",
      description: "Step into the enchanting world of the Herb Bar in Austin, Texas, where every visit feels like a cozy escape into a whimsical cabin in the woods! As you enter, you're greeted by the delightful aroma of herbs and the soothing ambiance that instantly warms your heart. \nThe Herb Bar features two distinct rooms: one filled with an array of dried herbs that invite you to explore their natural wonders, and another showcasing a treasure trove of local products that celebrate the spirit of Austin.Each corner is brimming with unique finds that capture the essence of the community! \nAs if that weren't enough, you're welcomed with a daily tea that wraps around you like a warm hug—perfect for melting away the hustle and bustle of your day.\nThe staff at the Herb Bar are not just friendly; they are also incredibly caring and knowledgeable, always ready to guide you through their offerings with a smile.\nNestled away from the clamor of Congress Avenue, this little gem provides a serene oasis in a quaint neighborhood, making it the perfect spot to unwind and connect with nature.Whether you're a local or just passing through, the Herb Bar promises a magical experience that's hard to forget!",
      tagline: "A Magical Retreat",
      coverPhoto: "/assets/places/herb-bar-cover.jpg",
      photos: [
        "/assets/places/herb-bar-1.png",
        "/assets/places/herb-bar-2.png"
      ],
      longitude: -97.75,
      latitude: 30.24
    },
    {
      id: 3,
      name: "Earth Commons",
      website: "https://earth-commons.com/",
      address: "641 Tillery St Suite 105",
      city: "Austin",
      state: "Texas",
      zip: "78702",
      description: "Get ready to embark on a journey of herbal discovery at Earth Commons, the vibrant East Austin herb shop that's impossible to miss! With a huge HERB sign beckoning all herbalists and curious souls alike, this shop invites you into a world filled with organic herbs, soothing teas, thoughtful gifts, and rejuvenating body care products. \nStep inside and immerse yourself in the modern vibe created by bright lights and unique scents wafting from dried herbs and local products curated by talented herbalists.The shop features two charming rooms, each with its own character, but it's the back room that truly enchants—dedicated to all things magical! \nHere, you can sit down and enjoy a tarot reading, sip on a specially crafted astrology tea, or consult with seasoned herbalists who bring years of experience and wisdom to the table.Whether you're seeking guidance or simply want to explore the wonders of nature, Earth Commons offers a unique blend of the modern and the magical, making it a must-visit destination in Austin. Come on in, and let the adventure begin!",
      tagline: "East Austin Herbal Oasis",
      coverPhoto: "/assets/places/earth-commons-cover.jpg",
      photos: [
        "/assets/places/earth-commons-1.png",
      ],
      longitude: -97.71,
      latitude: 30.26
    },
    {
      id: 8,
      name: "Boggy Creek Farm",
      website: "https://www.boggycreekfarm.com/",
      address: "3414 Lyons Rd",
      city: "Austin",
      state: "Texas",
      zip: "78702",
      description: "Step into Boggy Farms, and leave the hustle and bustle of the busy city behind. As you walk through the charming entrance of the small barn, you are greeted by an explosion of vibrant colors. The shelves are adorned with an array of fresh produce, from radiant red tomatoes to lush green cucumbers, each item more inviting than the last. \nIn addition to the produce, the barn showcases local farm- fresh meats, farm - fresh eggs, and golden jars of honey, all sourced from the very fields surrounding you.It's a delightful reminder of the richness of local farming and sustainable practices, making each visit a feast for the senses. \nAs you step outside, the magic continues.Stroll through the farm and let the gentle breeze carry the intoxicating scents of fresh flowers and herbs.Each inhalation transports you deeper into your own little world—a sanctuary filled with the earthy fragrance of basil, the sweetness of blooming flowers, and the refreshing aroma of mint.With every step, you feel a sense of peace enveloping you, as if you've entered a hidden paradise where nature reigns supreme.At Boggy Farms, you're not just a visitor; you're a part of a vibrant tapestry of plants, flavors, and magic, inviting you to pause, breathe, and immerse yourself in the beauty around you.",
      tagline: "Savor the Magic of Produce and Herbs",
      coverPhoto: "/assets/places/boggy-creek-cover.jpg",
      photos: [
        "/assets/places/boggy-creek-1.jpeg",
        "/assets/places/boggy-creek-2.jpeg",
        "/assets/places/boggy-creek-3.jpeg",
      ],
      longitude: -97.70,
      latitude: 30.26
    },
    {
      id: 4,
      name: "June Bloom Lavender",
      website: "https://www.junebloomlavender.com/",
      address: "209 E Main St Suite D",
      city: "Johnson City",
      state: "Texas",
      zip: "78636",
      description: "Nestled in the heart of Johnson City, June Bloom Lavender is a delightful boutique lavender business that beckons you in with the soothing aroma of lavender wafting from its cozy corner in the shopping center. As you step inside, you're enveloped in a relaxing and inviting atmosphere, where the gentle scent of lavender instantly calms your senses. \nJune Bloom Lavender is dedicated to cultivating 400 lavender plants to create a variety of products and experiences aimed at enhancing well- being.With a mission to promote mental health and self - care, this unique shop offers a range of relaxing products and services designed  for everyone. \nOne of the standout offerings is the Lavender Bunnies, lovingly created by the owner, a devoted bunny mom who has rescued many bunnies.These adorable creations are made from Minky fabric, providing a tactile sensory experience that is incredibly soft to touch, cuddle, and fidget with.Filled with flaxseed, they have a comforting weight, perfect for resting on your forehead or providing a soothing, grainy feel for fidgeting. \nEach Lavender Bunny is infused with French lavender, which releases calming aromatherapy when caressed, snuggled, or fidgeted with, making them perfect companions for easing anxiety and promoting relaxation.At June Bloom Lavender, you'll find a haven of tranquility and a commitment to nurturing well - being—one lavender scent at a time!",
      tagline: "Experience A Lavender Serenity.",
      coverPhoto: "/assets/places/june-bloom-cover.jpg",
      photos: [
        "/assets/places/june-bloom-1.png",
        "/assets/places/june-bloom-2.png"
      ],
      longitude: -98.41,
      latitude: 30.28
    },
    {
      id: 5,
      name: "Comfort Botanical Apothecary",
      website: "https://ctmbotanicalapothecary.com/",
      address: "409 Seventh St",
      city: "Comfort",
      state: "Texas",
      zip: "78013",
      description: "Nestled in the delightful town of Comfort, Texas, where charm meets tranquility, you'll find the enchanting Comfort Botanical Apothecary—a magical oasis of wellness that truly lives up to its name! As you wander through the quaint antique stores that line the streets of Comfort, let your curiosity guide you to this hidden gem that promises to elevate your spirit and soothe your soul. \nStepping inside feels like entering an old- world German - style home, filled with an inviting warmth that wraps around you like a cozy blanket.The apothecary showcases a stunning array of locally sourced and made products, from soothing salves to therapeutic herbal oils, ensuring you have everything you need to heal your body from the inside out. \nIn the back, you'll discover a serene space dedicated to yoga and consultations, providing a perfect sanctuary for mindfulness and holistic healing. But perhaps the best part of Comfort Botanical Apothecary is the owner, who radiates knowledge and passion. You can easily lose track of time chatting with her, soaking up insights about herbal remedies and wellness practices that will leave you inspired and uplifted. \nWhether you're a local or just passing through, a visit to Comfort Botanical Apothecary is a must. It's not just a shop; it's a magical experience that will leave you feeling refreshed and connected to the healing power of nature!",
      tagline: "Discover the Enchantment of Comfort",
      coverPhoto: "/assets/places/comfort-botanical-cover.jpg",
      photos: [
        "/assets/places/comfort-botanical-1.png",
      ],
      longitude: -98.91,
      latitude: 29.97
    },
    {
      id: 6,
      name: "Tucson Herb Store",
      website: "https://www.tucsonherbstore.com/",
      address: "228 N 4th Ave",
      city: "Tucson",
      state: "Arizona",
      zip: "85705",
      description: "Tucked away on the vibrant Fourth Avenue in Tucson, the Tucson Herb Store is a hidden gem brimming with enchantment and healing energy. As you step through the doors, you'll feel as if you've entered a secret sanctuary designed to nourish your soul and uplift your spirit. \nThis herb store, infused with the essence of magic dust and desert healing, offers an impressive selection of dried herbs, potent tinctures, and personalized consulting to help you on your wellness journey.Each corner is filled with the rich aromas of nature, inviting you to explore the myriad of remedies that await. \nThe talented owner, Amanda, also provides acupuncture services, ensuring you receive a holistic approach to your well- being.Whether you're battling the extremes of desert weather or simply seeking a moment of tranquility, Tucson Herb Store equips you with everything you need to thrive in the desert landscape. \nPrepare to be captivated by the atmosphere and leave with a sense of rejuvenation, ready to embrace whatever life throws your way!",
      tagline: "Unveil the Desert Magic",
      coverPhoto: "/assets/places/tucson-herb-cover.jpg",
      photos: [
        "/assets/places/tucson-herb-1.png",
        "/assets/places/tucson-herb-2.png"
      ],
      longitude: -110.97,
      latitude: 32.22
    },
    {
      id: 7,
      name: "Grateful Desert Apothecary",
      website: "https://www.gratefuldesert.com/",
      address: "61607 29 Palms Hwy Suite A",
      city: "Joshua Tree",
      state: "California",
      zip: "92252",
      description: "In the heart of Joshua Tree, a magical oasis awaits at Grateful Desert Apothecary, where the healing powers of the desert come to life! This unique space offers everything from enchanting perfumes to custom oils, all crafted to elevate your well-being and connection to nature. \nAt the helm is a goddess alchemist who artfully blends potent tinctures, turning nature's gifts into transformative remedies that nourish both body and soul.As you step into this cool, welcoming sanctuary, you'll instantly feel a sense of belonging within the vibrant community that thrives here. \nOn those hot desert days, take refuge at Grateful Desert Apothecary and immerse yourself in a nurturing environment where you can heal every part of your being.Whether you're seeking relaxation, rejuvenation, or simply a moment of magic, this apothecary promises to be a truly unforgettable experience!",
      tagline: "Unleash the Desert's Healing Energy",
      coverPhoto: "/assets/places/grateful-desert-cover.jpg",
      photos: [
        "/assets/places/grateful-desert-1.png",
      ],
      longitude: -116.32,
      latitude: 34.13
    },
  ];

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