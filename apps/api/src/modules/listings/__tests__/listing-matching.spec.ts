/**
 * BRK-5 — a listing against a lead's requirements.
 */
import { ListingKind } from '@prisma/client';
import { matchListing } from '../listing-matching';

const listing = { kind: ListingKind.RESALE, price: 4_500_000, city: 'القاهرة الجديدة', district: 'التجمع الخامس', compound: null, unitType: '3BR', bedrooms: 3, area: 165 };
const req = { kinds: [ListingKind.RESALE], budgetMin: 3_000_000, budgetMax: 5_000_000, cities: ['التجمع'], unitTypes: ['3BR'], bedroomsMin: 3, areaMin: 150 };

describe('matchListing', () => {
  it('a listing that meets every criterion scores 100, with the reasons', () => {
    expect(matchListing(listing, req)).toEqual({ score: 100, reasons: ['budget', 'city', 'unitType', 'bedrooms', 'area'] });
  });

  it('the kind is a hard filter, and so is a price more than 10% over budget', () => {
    expect(matchListing({ ...listing, kind: ListingKind.RENT }, req)).toBeNull();
    expect(matchListing({ ...listing, price: 5_600_000 }, req)).toBeNull();
  });

  it('up to 10% over budget still shows, at half the budget points', () => {
    expect(matchListing({ ...listing, price: 5_400_000 }, req)).toEqual({ score: 85, reasons: ['budgetNear', 'city', 'unitType', 'bedrooms', 'area'] });
  });

  it('scores only what the lead asked for; the city reads past hamza and taa marbuta', () => {
    const r = { kinds: [], budgetMin: null, budgetMax: null, cities: ['التجمع الخامسة'], unitTypes: [], bedroomsMin: 4, areaMin: null };
    expect(matchListing({ ...listing, district: 'التجمع الخامسه' }, r)).toEqual({ score: 63, reasons: ['city'] });
  });

  it('a requirement with nothing in it matches nothing; with only a kind, every listing of that kind', () => {
    const empty = { kinds: [], budgetMin: null, budgetMax: null, cities: [], unitTypes: [], bedroomsMin: null, areaMin: null };
    expect(matchListing(listing, empty)).toBeNull();
    expect(matchListing(listing, { ...empty, kinds: [ListingKind.RESALE] })).toEqual({ score: 100, reasons: [] });
  });
});
