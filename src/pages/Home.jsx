import HerbMap from "../components/Map";
import { Helmet } from "react-helmet";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Little Herb Places | Home</title>
      </Helmet>
      <HerbMap />
    </>
  )
}