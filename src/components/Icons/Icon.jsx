import PropTypes from 'prop-types';
import PlaceIcon from '../../assets/icons/place.svg?react';
import ThriveIcon from '../../assets/icons/thrive.svg?react';
import LeafIcon from '../../assets/icons/leaf.svg?react';
import SproutIcon from '../../assets/icons/sprout.svg?react';
import BloomIcon from '../../assets/icons/bloom.svg?react';
import LocationIcon from '../../assets/location-icon.svg?react';
import BadgeIcon from '../../assets/icons/badge.svg?react';
import HeartIcon from '../../assets/icons/heart.svg?react';
import LightbulbIcon from '../../assets/icons/lightbulb.svg?react';
import GroupIcon from '../../assets/icons/group.svg?react';
import CommunityIcon from '../../assets/icons/community.svg?react';
import SparklesIcon from '../../assets/icons/sparkles.svg?react';
import GardenIcon from '../../assets/icons/garden.svg?react';
import CraftIcon from '../../assets/icons/craft.svg?react';
import MapPlaceIcon from '../../assets/icons/map.svg?react';

const brandIcons = { shop: PlaceIcon, places: MapPlaceIcon, leaf: LeafIcon, thrive: ThriveIcon, sprout: SproutIcon, sun: BloomIcon, pin: LocationIcon, badge: BadgeIcon, heart: HeartIcon, lightbulb: LightbulbIcon, group: GroupIcon, community: CommunityIcon, sparkles: SparklesIcon, garden: GardenIcon, craft: CraftIcon };

const paths = {
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  phone: <path d="m7 3 3 5-2 2a15 15 0 0 0 6 6l2-2 5 3v3a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3Z" />,
  link: <><path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 1)" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  expand: <><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6" /><path d="m3 3 6 6m12-6-6 6M3 21l6-6m12 6-6-6" /></>,
  arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="m5 5 14 14M5 19 19 5" />,
  map: <><path d="m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3V5Zm6-3v17m8-14v17" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
};
export default function Icon({ name, size = 20, ...props }) {
  const BrandIcon = brandIcons[name];
  if (BrandIcon) return <BrandIcon data-icon={name} width={size} height={size} aria-hidden="true" focusable="false" {...props} />;
  return <svg data-icon={name} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
Icon.propTypes = { name: PropTypes.string.isRequired, size: PropTypes.number };
