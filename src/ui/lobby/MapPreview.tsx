import { getMap, getMapPreviewUrl } from '../../content/maps';

export function MapPreview({ mapId, compact = false }: { mapId: string; compact?: boolean }) {
  const map = getMap(mapId);

  return (
    <div
      className={`map-preview${compact ? ' map-preview-compact' : ''}`}
      style={{ '--map-accent': map.theme.accent } as React.CSSProperties}
    >
      <img src={getMapPreviewUrl(map.id)} alt={`${map.name} layout preview`} loading="lazy" />
      <div className="map-preview-caption">
        <strong>{map.name}</strong>
        {map.tags.length > 0 && <span>{map.tags.join(' · ')}</span>}
      </div>
    </div>
  );
}
