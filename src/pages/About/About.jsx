import styles from "./about.module.scss";
import { Helmet } from "react-helmet";

export default function About() {

  return (
    <>
      <Helmet>
        <title>Little Herb Places | About</title>
      </Helmet>
      <div className={styles.container}>
        <p>Welcome to Little Herb Places!</p>
        <p>We invite you to embark on a journey through the vibrant world of herbalism. Our site is your resource for discovering herb shops around the world and local herbalists and medicine makers around the corner.</p>
        <p>Our mission is to bridge the gap between herbalists and their communities. To give a voice to those who craft medicine from Earth&apos;s finest plants and herbs while providing a place for them to share their stories and sell their products.</p>
        <p>Join us in celebrating the art of herbalism and connect with your local community.</p>
      </div>
    </>
  )
}
