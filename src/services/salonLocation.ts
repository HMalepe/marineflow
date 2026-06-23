import type { Salon } from '@prisma/client';
import { env } from '../config.js';
import { logger } from '../lib/logger.js';

export interface SalonLocationInfo {
  address: string;
  mapsUrl: string;
  parkingNotes: string | null;
  accessibility: string | null;
  /** Only set when GOOGLE_MAPS_API_KEY is configured and a customer origin was given. */
  distanceText?: string;
  durationText?: string;
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(env.GOOGLE_MAPS_API_KEY?.trim());
}

function buildMapsUrl(salon: Salon, address: string): string {
  const existing = (salon as unknown as { mapsUrl?: string | null }).mapsUrl;
  if (existing) return existing;
  const query = encodeURIComponent(`${salon.tradingName ?? salon.name} ${address}`);
  return `https://maps.google.com/?q=${query}`;
}

/**
 * Salon address/maps info, with an optional live driving distance + ETA when the
 * customer has volunteered their own location and Google Maps is configured.
 */
export async function getSalonLocationInfo(
  salon: Salon,
  customerOrigin?: string,
): Promise<SalonLocationInfo> {
  const address = salon.addressLine ?? 'Address not on file.';
  const info: SalonLocationInfo = {
    address,
    mapsUrl: buildMapsUrl(salon, address),
    parkingNotes: salon.parkingNotes ?? null,
    accessibility: salon.accessibility ?? null,
  };

  if (!customerOrigin || !salon.addressLine || !isGoogleMapsConfigured()) {
    return info;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', customerOrigin);
    url.searchParams.set('destinations', salon.addressLine);
    url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY!);

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      rows?: { elements?: { status: string; distance?: { text: string }; duration?: { text: string } }[] }[];
    };
    const element = data.rows?.[0]?.elements?.[0];
    if (element?.status === 'OK') {
      info.distanceText = element.distance?.text;
      info.durationText = element.duration?.text;
    }
  } catch (err) {
    logger.warn({ err }, 'google_maps_distance_failed');
  }

  return info;
}
