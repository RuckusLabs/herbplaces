import MapComponent from "../../components/MapComponent/MapComponent";
import ListComponent from "../../components/List/List";
import { Helmet } from "react-helmet";
import styles from "./home.module.scss";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Little Herb Places | Home</title>
      </Helmet>
      <div className={styles.container}>
        <ListComponent />
        <MapComponent />
      </div>
    </>
  )
}