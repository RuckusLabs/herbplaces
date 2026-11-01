import PropTypes from 'prop-types';
import ListComponent from '../List/List';

export default function MapComponent({ places }) {
  return <section aria-label="Places results"><ListComponent places={places} /></section>;
}
MapComponent.propTypes = { places: PropTypes.array.isRequired };
