import PropTypes from 'prop-types';
import './Header.scss';

export default function Header({ title, backgroundImage }) {
  return (
    <header
      className="header"
      style={
        backgroundImage
          ? {
              backgroundImage: `url(${backgroundImage})`,
            }
          : {}
      }
    >
      <div className="wrapper">
        <h1>{title}</h1>
      </div>
      <div className="gradientBlur">
        <div></div>
        <div></div>
        <div></div>
      </div>
      <div className="gradientBlurTop">
        <div></div>
        <div></div>
        <div></div>
      </div>
    </header>
  );
}

Header.propTypes = {
  title: PropTypes.string.isRequired,
  backgroundImage: PropTypes.string,
}; 