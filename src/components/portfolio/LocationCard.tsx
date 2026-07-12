import { MapPin } from "lucide-react";
import { bio } from "@/lib/portfolio/content";

export default function LocationCard() {
  return (
    <aside className="location-capsule" aria-label={bio.location.title}>
      <span className="location-capsule__pin" aria-hidden="true">
        <MapPin />
      </span>
      <span className="location-capsule__copy">
        <span className="location-capsule__heading">
          <strong>{bio.location.title}</strong>
          <span className="location-capsule__status" aria-label="Available">
            <i aria-hidden="true" /> Available
          </span>
        </span>
        <span>{bio.location.subtitle}</span>
        <span className="location-capsule__availability">{bio.location.status}</span>
      </span>
    </aside>
  );
}
