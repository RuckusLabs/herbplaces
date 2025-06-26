import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import styles from "./help.module.scss";

export default function Help() {
  return (
    <>
      <Helmet>
        <title>Little Herb Places | Help</title>
      </Helmet>
      <div className={styles.container}>
        <h1>How can we help you?</h1>
        <p className="text-align-center" style={{ margin: "2rem" }}>
          If you have questions or need assistance, you're in the right place. Simply email us at <a href="mailto:help@littleherbplaces.com">help@littleherbplaces.com</a> and we'll get back to you as soon as possible.
        </p>
      </div>
    </>
  );
}