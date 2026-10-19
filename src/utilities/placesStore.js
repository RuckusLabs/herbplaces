import fetchPlaces from './fetchPlaces';
import { createSharedPlaces } from './sharedPlaces';

const store = createSharedPlaces(fetchPlaces);
export const subscribeToPlaces = store.subscribe;
export const getPlacesSnapshot = store.snapshot;
export const updatePublishedPlace = store.publish;
export const refreshPlaces = store.refresh;
