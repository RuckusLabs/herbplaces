import { Helmet } from "react-helmet";
import MapComponent from "../../components/MapComponent/MapComponent";
import styles from "./map.module.scss";

export default function Map() {
  return (
    <>
      <Helmet>
        <title>Map | Little Herb Places</title>
      </Helmet>
      <div className={styles.container}>
        <MapComponent />
      </div>
    </>
  )
}