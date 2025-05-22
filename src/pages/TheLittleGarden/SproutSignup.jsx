import React, { useRef, useState, useEffect } from 'react';
import { Helmet } from "react-helmet";
import styles from "./thelittlegarden.module.scss"

import SproutIcon from "/assets/icons/sprout.svg";

export default function SproutSignup() {

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const iframeRef = useRef(null);

  const handleIframeLoad = () => {
    if (!isSubmitting) return;
    
    try {
      const iframeContent = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
      
      // Check for Mailchimp error messages
      const errorElement = iframeContent.querySelector('.mce_inline_error');
      const successElement = iframeContent.querySelector('#mce-success-response');
      
      if (errorElement) {
        setError(errorElement.textContent || 'Registration failed. Please try again.');
        setSubmitted(false);
      } else if (successElement) {
        setError('');
        setSubmitted(true);
      }
    } catch (err) {
      console.error('Error checking registration status:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    setIsSubmitting(true);
    setError('');
    // Form will submit normally due to action attribute
  };

  return (
    <>
      <Helmet>
        <title>Sprout Signup | The Little Garden | Little Herb Places</title>
      </Helmet>
      <section className={styles.sproutSignup}>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.content}>
              <h4><img src={SproutIcon} alt="A sprout icon." /> Sprout</h4>
              <p className="padding-r-desktop-10">Plant the seed and start your journey.</p>
              <ul>
                <li>Join the community.</li>
              </ul>
              {submitted ? (
                <p className={styles.success}>Thanks for subscribing! 🌿</p>
              ) : (
                <>
                  <form
                    action="https://littleherbplaces.us11.list-manage.com/subscribe/post?u=ac649b78dd0024f5b2ecd08e5&amp;id=566234165b&amp;f_id=0063c6e3f0"
                    method="POST"
                    target="hidden_iframe"
                    noValidate
                    className={styles.form}
                    onSubmit={handleSubmit}
                  >
                    <input type="hidden" name="f_id" value="0063c6e3f0" />

                    <label htmlFor="email" className="sr-only">Email (Required)</label>
                    <input
                      type="email"
                      id="email"
                      autoComplete="email"
                      name="EMAIL"
                      placeholder="Your email"
                      required
                      className=""
                    />

                    <label htmlFor="fname" className="sr-only">First name</label>
                    <input
                      type="text"
                      name="FNAME"
                      autoComplete="given-name"
                      placeholder="First name"
                      className=""
                    />

                    <label htmlFor="lname" className="sr-only">Last name</label>
                    <input
                      type="text"
                      name="LNAME"
                      autoComplete="family-name"
                      placeholder="Last name"
                      className=""
                    />
                    <label htmlFor="company" className="sr-only">Shop name</label>
                    <input
                      type="text"
                      name="COMPANY"
                      autoComplete="organization"
                      placeholder="Shop name"
                      className=""
                    />

                    <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
                      <input
                        type="text"
                        name="b_ac649b78dd0024f5b2ecd08e5_566234165b"
                        tabIndex="-1"
                        defaultValue=""
                      />
                    </div>

                    {error && (
                      <div className={styles.error}>
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="button"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Signing up...' : 'Sign up for Sprout'}
                    </button>
                  </form>

                  <iframe
                    name="hidden_iframe"
                    ref={iframeRef}
                    onLoad={handleIframeLoad}
                    style={{ display: 'none' }}
                    title="MailChimp"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </section>
      
    </>
  )
}