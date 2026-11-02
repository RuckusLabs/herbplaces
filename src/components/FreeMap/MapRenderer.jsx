import { forwardRef } from 'react';
import Map from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

maplibregl.setWorkerUrl(workerUrl);

const MapRenderer = forwardRef(function MapRenderer(props, ref) {
  return <Map {...props} ref={ref} mapLib={maplibregl} />;
});
export default MapRenderer;
