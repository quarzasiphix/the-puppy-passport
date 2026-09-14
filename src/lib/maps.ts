// Zero-API-key Google Maps link builders — plain deep-link URLs Maps itself resolves (geocoding an
// address, plotting a route) when opened, not anything this app computes. No Google Maps API key
// or server-side geocoding involved anywhere here; see docs/TRANSPORT_MARKETPLACE_VISION.md for
// why real geocoding/route optimization stays a later, separate phase.

/** A plain "search this address" link — what a pasted pickup/dropoff Maps link has always meant
 * in this app, just generated from typed address text instead of requiring it be pasted by hand. */
export function buildMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

/** A turn-by-turn directions link across an ordered list of checkpoints (first = origin, last =
 * destination, anything between = waypoints) — each entry can be a full address or an existing
 * Maps search/place URL's own query text, Maps resolves either. Google's directions URL API caps
 * waypoints in practice (~10 is the safe, documented limit); callers should slice before this if a
 * route ever has more stops than that. */
export function buildMapsDirectionsUrl(checkpoints: string[]): string | null {
  const points = checkpoints.map((p) => p.trim()).filter(Boolean);
  if (points.length < 2) return null;
  const [origin, destination, ...waypoints] = [
    points[0],
    points[points.length - 1],
    ...points.slice(1, -1),
  ];
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
  });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** The reverse direction: best-effort extraction of a human-readable address/place name back out
 * of a pasted Google Maps URL, for the two URL shapes that actually carry one in plain text —
 * a search link's `query`/`q` param (what buildMapsSearchUrl itself generates, and what Google's
 * own "Share > Copy link" produces for a search result) and a `/maps/place/<Name>/...` link's
 * place-name path segment. Deliberately returns null (never throws, never guesses) for anything
 * else — a `maps.app.goo.gl`/`goo.gl/maps` short link or a bare `@lat,lng` URL carries no address
 * text at all without following a redirect this function can't make client-side, and a bare
 * coordinate pair isn't an address either. Callers should treat null as "nothing to prefill," not
 * an error. */
export function parseAddressFromMapsUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)google\.[a-z.]+$/i.test(parsed.hostname)) return null;

  const query = parsed.searchParams.get("query") ?? parsed.searchParams.get("q");
  if (query && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(query)) {
    return decodeURIComponent(query.replace(/\+/g, " "));
  }

  const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/@]+)/);
  if (placeMatch) return decodeURIComponent(placeMatch[1].replace(/\+/g, " "));

  return null;
}
