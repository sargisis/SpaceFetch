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
