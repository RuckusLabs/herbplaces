import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';
import { getRouteSeo, serializeJson, SITE_NAME } from '../../utilities/seo';

export default function Seo({ metadata }) {
  const { pathname, search } = useLocation();
  const seo = metadata || getRouteSeo(pathname, search);
  return <Helmet>
    <title>{seo.title}</title>
    <meta name="description" content={seo.description} />
    <meta name="robots" content={seo.robots} />
    <link rel="canonical" href={seo.canonical} />
    <meta property="og:type" content={seo.type} />
    <meta property="og:site_name" content={SITE_NAME} />
    <meta property="og:title" content={seo.title} />
    <meta property="og:description" content={seo.description} />
    <meta property="og:url" content={seo.canonical} />
    <meta property="og:image" content={seo.image} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:alt" content={seo.imageAlt} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={seo.title} />
    <meta name="twitter:description" content={seo.description} />
    <meta name="twitter:image" content={seo.image} />
    <meta name="twitter:image:alt" content={seo.imageAlt} />
    {seo.structuredData && <script type="application/ld+json">{serializeJson(seo.structuredData)}</script>}
  </Helmet>;
}
Seo.propTypes = { metadata: PropTypes.object };
