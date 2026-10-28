import PropTypes from 'prop-types';
import SettingsIcon from '../../assets/icons/settings.svg?react';
import SignOutIcon from '../../assets/icons/sign-out.svg?react';
import BookIcon from '../../assets/icons/book.svg?react';
import PolaroidIcon from '../../assets/icons/polaroid.svg?react';
import BrandClockIcon from '../../assets/icons/brand-clock.svg?react';
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
import NearbyIcon from '../../assets/icons/nearby.svg?react';

const brandIcons = { settings: SettingsIcon, 'sign-out': SignOutIcon, book: BookIcon, polaroid: PolaroidIcon, 'brand-clock': BrandClockIcon, shop: PlaceIcon, places: MapPlaceIcon, nearby: NearbyIcon, leaf: LeafIcon, thrive: ThriveIcon, sprout: SproutIcon, sun: BloomIcon, pin: LocationIcon, badge: BadgeIcon, heart: HeartIcon, lightbulb: LightbulbIcon, group: GroupIcon, community: CommunityIcon, sparkles: SparklesIcon, garden: GardenIcon, craft: CraftIcon };

const paths = {
  'plan-story': <><path d="M5 3h10l4 4v14H5Z M14 3v5h5 M8 12h8 M8 16h6" /><path d="m8 7 2-2" /></>,
  'plan-gallery': <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8" cy="9" r="1.5" /><path d="m4 17 5-5 4 4 3-3 5 5" /></>,
  'plan-contact': <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8.5" cy="10" r="2" /><path d="M5.5 16c0-3 6-3 6 0 M14 9h4 M14 13h4 M14 17h2" /></>,
  'plan-action': <><path d="m5 3 3 16 4-6 6-4L5 3Z M12 13l5 7 M17 3v2 M21 7h-2" /></>,
  'plan-announcement': <><path d="m4 9 13-5v15L4 14Z M4 9H2v5h2 M6 15l2 6h4l-3-5 M20 8l2-1 M20 15l2 1" /></>,
  'plan-report': <><path d="M4 3v18h17 M8 17v-5 M13 17V7 M18 17V4" /><path d="m8 7 4-3" /></>,
  'plan-email': <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6 M4 17l5-5 M20 17l-5-5" /></>,
  'plan-access': <><circle cx="12" cy="4" r="2" /><path d="M4 9c5 2 11 2 16 0 M12 10v6 M12 16l-5 5 M12 16l5 5" /></>,
  'plan-team': <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3 M16 5a3 3 0 0 1 0 6 M18 14a5 5 0 0 1 3 5v2" /></>,
  'plan-profile': <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18 M9 9v12 M13 13h4 M13 17h3" /><circle cx="6" cy="6" r=".4" /></>,
  'plan-offerings': <><path d="m3 7 9-4 9 4v11l-9 4-9-4Z M3 7l9 4 9-4 M12 11v11 M8 5l9 4v4" /></>,
  'plan-events': <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v5 M17 3v5 M3 11h18 M8 15h2 M14 15h2 M8 18h2" /></>,
  'plan-discovery': <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6 M10 7v6 M7 10h6 M19 3v4 M17 5h4" /></>,
  'sidebar-collapse': <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m7-12-4 4 4 4" /></>,
  'sidebar-expand': <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m4-12 4 4-4 4" /></>,
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
  return <svg data-icon={name} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name.startsWith('plan-') ? 1.6 : 1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
Icon.propTypes = { name: PropTypes.string.isRequired, size: PropTypes.number };
