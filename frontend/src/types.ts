/**
 * Authenticated console user, restored from the httpOnly session cookie via
 * GET /v1/auth/me. `apiKey` is only present in memory right after
 * registration or key rotation — it is never persisted in the browser.
 */
export interface SessionUser {
  email: string;
  tier: string;
  apiKey?: string;
}

export interface APODData {
  date: string;
  title: string;
  explanation: string;
  media_type: string;
  url: string;
  hd_url?: string;
  copyright?: string;
}

export interface EPICData {
  date: string;
  caption: string;
  image_url: string;
  latitude: number;
  longitude: number;
}

export interface EPICDisplay {
  date: string;
  lat: number;
  lon: number;
  imgUrl: string;
}

export interface AsteroidData {
  id: string;
  name: string;
  is_hazardous: boolean;
  metrics: {
    diameter_meters: number;
    velocity_km_h: number;
    miss_distance_km: number;
  };
  mining_economy: {
    estimated_value_usd: number;
    primary_materials: string[];
    mining_difficulty: string;
    spectral_class?: string;
  };
  ai_summary: {
    en: string;
    ru: string;
  } | string;
  close_approach_date?: string;
}
