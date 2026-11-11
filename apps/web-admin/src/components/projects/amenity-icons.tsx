import {
  ArrowUpDown, Baby, Bike, Briefcase, Building2, Cctv, Check, Church, Coffee, Droplets, Dumbbell, Flower,
  Flower2, Footprints, Goal, GraduationCap, Hospital, Hotel, House, HousePlug, Landmark, MapPin, MoonStar,
  Mountain, Pill, Plane, Route, School, ShieldCheck, ShoppingBag, SquareParking, Star, Stethoscope, Store,
  Sun, ToyBrick, TrainFront, TreePine, Trees, Trophy, UtensilsCrossed, Volleyball, Waves, WavesLadder, Wifi,
  Zap, type LucideIcon,
} from 'lucide-react';
import type { AmenityIcon } from '@rep/shared-types';

/**
 * The dashboard's drawing for each amenity icon key (packages/shared-types
 * AMENITY_ICONS). The website keeps the same map; the customer app maps the
 * keys to its own icons.
 */
export const AMENITY_ICON_COMPONENTS: Record<AmenityIcon, LucideIcon> = {
  pool: WavesLadder, gym: Dumbbell, garden: Flower2, park: Trees, tree: TreePine, playground: ToyBrick,
  kids: Baby, security: ShieldCheck, cctv: Cctv, parking: SquareParking, elevator: ArrowUpDown,
  clubhouse: House, mall: ShoppingBag, shop: Store, restaurant: UtensilsCrossed, cafe: Coffee,
  mosque: MoonStar, church: Church, school: School, university: GraduationCap, hospital: Hospital,
  clinic: Stethoscope, pharmacy: Pill, bank: Landmark, sea: Waves, lake: Droplets, view: Mountain,
  jogging: Footprints, bike: Bike, sports: Trophy, tennis: Volleyball, football: Goal, spa: Flower,
  wifi: Wifi, solar: Sun, 'smart-home': HousePlug, generator: Zap, hotel: Hotel, office: Briefcase,
  metro: TrainFront, road: Route, airport: Plane, location: MapPin, building: Building2, star: Star,
  check: Check,
};

export function AmenityIconView({ icon, className }: { icon: string; className?: string }) {
  const Icon = AMENITY_ICON_COMPONENTS[icon as AmenityIcon] ?? Check;
  return <Icon className={className} aria-hidden />;
}
