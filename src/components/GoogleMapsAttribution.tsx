// The "Google Maps" credit shown next to any Google data.
// Google's rules for showing Places or Routes data outside a Google map: show "Google Maps" (exactly that text,
// not translated or re-capitalised) near the top or bottom of the same box, always visible.
// https://developers.google.com/maps/documentation/places/web-service/policies
export default function GoogleMapsAttribution({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-ink-soft ${className}`}>
      <span aria-label="Google Maps" translate="no">Google Maps</span>
    </p>
  );
}
