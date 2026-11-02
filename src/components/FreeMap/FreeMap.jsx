import { Component, forwardRef, lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { freeMapRequest, MAP_LOAD_TIMEOUT_MS, MAP_STYLE } from '../../utilities/mapConfig';

const MapRenderer = lazy(() => import('./MapRenderer'));

class MapBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
MapBoundary.propTypes = { children: PropTypes.node, onFailure: PropTypes.func.isRequired };

// Covers loading the lazy renderer, WebGL setup, and remote style/tile errors.
const FreeMap = forwardRef(function FreeMap({ onFailure, onLoad, ...props }, ref) {
  const timer = useRef(null);
  const failed = useRef(false);
  const fail = useCallback(() => {
    if (failed.current) return;
    failed.current = true;
    clearTimeout(timer.current);
    onFailure();
  }, [onFailure]);
  useEffect(() => {
    timer.current = setTimeout(fail, MAP_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer.current);
  }, [fail]);
  const loaded = event => {
    if (failed.current) return;
    clearTimeout(timer.current);
    onLoad?.(event);
  };
  return <MapBoundary onFailure={fail}><Suspense fallback={null}>
    <MapRenderer {...props} ref={ref} mapStyle={MAP_STYLE} transformRequest={freeMapRequest} onLoad={loaded} onError={fail} />
  </Suspense></MapBoundary>;
});
FreeMap.propTypes = { onFailure: PropTypes.func.isRequired, onLoad: PropTypes.func };
export default FreeMap;
