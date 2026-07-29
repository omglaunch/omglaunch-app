export function buildGoogleReviewShortLink(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}
