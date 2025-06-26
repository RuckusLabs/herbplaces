import { Helmet } from "react-helmet";
import { useEffect, useState } from "react";
import MapComponent from "../../components/MapComponent/MapComponent";
import styles from "./map.module.scss";
import ListComponent from "../../components/List/List";


export default function Map() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <>
      <Helmet>
        <title>Map | Little Herb Places</title>
      </Helmet>
      <div className={styles.container}>
        <ListComponent />
        {!isMobile && (
            <MapComponent />
        )}
      </div>
    </>
  )
}