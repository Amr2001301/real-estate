import { SITE, siteUrl } from './seo';
import { getContactPhone } from './contact';

/** RealEstateAgent/Organization schema for the homepage. */
export function organizationLd() {
  // Sourced from NEXT_PUBLIC_CONTACT_PHONE; omitted entirely when unset
  // (never a fake placeholder number).
  const phone = getContactPhone();
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: SITE.name,
    url: siteUrl('/'),
    description: SITE.description,
    areaServed: 'SA',
    ...(phone ? { telephone: phone } : {}),
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'SA',
      addressLocality: 'الرياض',
    },
  };
}

export function breadcrumbLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: siteUrl(it.path),
    })),
  };
}

/** Conservative Residence schema for a project — only public-safe fields. */
export function projectResidenceLd(input: {
  name: string;
  description?: string;
  city?: string;
  lat?: number;
  lng?: number;
  image?: string | null;
  path: string;
}) {
  const hasCoords =
    typeof input.lat === 'number' && typeof input.lng === 'number' && (input.lat !== 0 || input.lng !== 0);
  return {
    '@context': 'https://schema.org',
    '@type': 'Residence',
    name: input.name,
    url: siteUrl(input.path),
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: input.image } : {}),
    ...(input.city
      ? { address: { '@type': 'PostalAddress', addressLocality: input.city, addressCountry: 'SA' } }
      : {}),
    ...(hasCoords
      ? { geo: { '@type': 'GeoCoordinates', latitude: input.lat, longitude: input.lng } }
      : {}),
  };
}

function availabilityFor(status: string): string {
  switch (status) {
    case 'AVAILABLE':
      return 'https://schema.org/InStock';
    case 'RESERVED':
      return 'https://schema.org/LimitedAvailability';
    case 'SOLD':
      return 'https://schema.org/SoldOut';
    default:
      return 'https://schema.org/InStock';
  }
}

/** Product + Offer for a unit — public-safe fields only. */
export function unitProductLd(input: {
  name: string;
  description?: string;
  price: string;
  status: string;
  image?: string | null;
  path: string;
}) {
  const priceNum = Number(input.price);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    url: siteUrl(input.path),
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: input.image } : {}),
    ...(Number.isFinite(priceNum) && priceNum > 0
      ? {
          offers: {
            '@type': 'Offer',
            price: String(priceNum),
            priceCurrency: 'SAR',
            availability: availabilityFor(input.status),
            url: siteUrl(input.path),
          },
        }
      : {}),
  };
}
