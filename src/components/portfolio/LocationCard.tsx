import { MapPin } from "lucide-react";
import { bio } from "@/lib/portfolio/content";

export default function LocationCard() {
  return (
    <aside className="location-capsule" aria-label={bio.location.title}>
      <span className="location-capsule__status" aria-hidden="true" />
      <span className="location-capsule__pin" aria-hidden="true">
        <MapPin />
      </span>
      <span className="location-capsule__copy">
        <strong>{bio.location.title}</strong>
        <span>{bio.location.subtitle}</span>
        <code>{bio.location.coordinates}</code>
      </span>
    </aside>
  );
}
