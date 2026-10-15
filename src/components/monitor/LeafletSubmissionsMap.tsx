import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { FormSubmission } from '../../types/survey';
import { MapPin, Filter, Layers, Navigation, Info, Eye } from 'lucide-react';

interface LeafletSubmissionsMapProps {
  submissions: FormSubmission[];
  selectedSubmission: FormSubmission | null;
  onSelectSubmission: (submission: FormSubmission) => void;
  filterWarningOnly?: boolean;
}

export const LeafletSubmissionsMap: React.FC<LeafletSubmissionsMapProps> = ({
  submissions,
  selectedSubmission,
  onSelectSubmission,
  filterWarningOnly = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [activeTileLayer, setActiveTileLayer] = useState<'standard' | 'humanitarian'>('standard');
  const [selectedFieldworker, setSelectedFieldworker] = useState<string>('all');

  const validGpsSubmissions = submissions.filter(
    (s) => s.gps_location && typeof s.gps_location.lat === 'number' && typeof s.gps_location.lng === 'number'
  );

  const displayedSubmissions = validGpsSubmissions.filter((s) => {
    const matchesWarning = filterWarningOnly ? s.quality_warnings && s.quality_warnings.length > 0 : true;
    const matchesFieldworker = selectedFieldworker === 'all' || s.enumerator_name === selectedFieldworker;
    return matchesWarning && matchesFieldworker;
  });

  // Extract unique fieldworkers
  const fieldworkers = Array.from(new Set(validGpsSubmissions.map((s) => s.enumerator_name)));

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Mutare District coordinates default center
      const initialLat = -18.9725;
      const initialLng = 32.6512;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 13,
        zoomControl: true,
      });

      const tileUrl = activeTileLayer === 'standard'
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';

      const tileLayer = L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | CMRG Geopoint Survey Layer',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer if changed
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapInstanceRef.current?.removeLayer(layer);
      }
    });

    const tileUrl = activeTileLayer === 'standard'
      ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      : 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';

    L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | CMRG Geopoint Survey Layer',
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);
  }, [activeTileLayer]);

  // Update Markers on Data / Filter Change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    const bounds = L.latLngBounds([]);

    displayedSubmissions.forEach((sub, idx) => {
      const lat = sub.gps_location!.lat;
      const lng = sub.gps_location!.lng;
      const isSelected = selectedSubmission?.id === sub.id;
      const hasWarning = sub.quality_warnings && sub.quality_warnings.length > 0;

      bounds.extend([lat, lng]);

      // Custom CMRG Red / Charcoal SVG Pin
      const pinColor = hasWarning ? '#f59e0b' : isSelected ? '#D71920' : '#111111';
      const pinSize = isSelected ? 32 : 26;

      const customIcon = L.divIcon({
        className: 'cmrg-custom-pin',
        html: `
          <div style="
            background-color: ${pinColor};
            width: ${pinSize}px;
            height: ${pinSize}px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid #ffffff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          ">
            <span style="
              transform: rotate(45deg);
              color: #ffffff;
              font-family: 'JetBrains Mono', monospace;
              font-weight: 800;
              font-size: 10px;
            ">
              ${hasWarning ? '!' : idx + 1}
            </span>
          </div>
        `,
        iconSize: [pinSize, pinSize],
        iconAnchor: [pinSize / 2, pinSize],
        popupAnchor: [0, -pinSize],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Clickable Popup matching CMRG Field Monitor details
      const popupContent = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; min-width: 200px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
            <strong style="color: #D71920; font-family: monospace;">${sub.case_id || sub.id.substring(0, 14)}</strong>
            <span style="background: ${sub.status === 'approved' ? '#dcfce7' : '#fee2e2'}; color: ${sub.status === 'approved' ? '#15803d' : '#b91c1c'}; font-size: 10px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-weight: bold;">
              ${sub.status}
            </span>
          </div>
          <div style="color: #334155; line-height: 1.5;">
            <div><strong>Respondent:</strong> ${sub.data?.respondent_name || 'N/A'}</div>
            <div><strong>Household Size:</strong> ${sub.data?.num_in_hh || 'N/A'} members</div>
            <div><strong>Water Source:</strong> ${sub.data?.water_source || 'N/A'}</div>
            <div><strong>Enumerator:</strong> ${sub.enumerator_name}</div>
            <div><strong>Duration:</strong> ${sub.metadata?.duration_seconds || 0}s</div>
            <div><strong>Accuracy:</strong> &plusmn;${sub.gps_location?.accuracy || 4.2}m</div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        onSelectSubmission(sub);
      });

      markersLayerRef.current?.addLayer(marker);
    });

    if (displayedSubmissions.length > 0 && bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [displayedSubmissions, selectedSubmission]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Map Control Bar */}
      <div className="p-3 bg-[#111111] text-white flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#D71920]" />
          <span className="font-bold tracking-tight">Leaflet Interactive GPS Monitor</span>
          <span className="text-[11px] text-slate-400 font-mono">
            ({displayedSubmissions.length} Plotted Geopoints)
          </span>
        </div>

        {/* Filter by Fieldworker */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">Fieldworker:</span>
          <select
            value={selectedFieldworker}
            onChange={(e) => setSelectedFieldworker(e.target.value)}
            className="bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-[#D71920]"
          >
            <option value="all">All Fieldworkers ({validGpsSubmissions.length})</option>
            {fieldworkers.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {/* Tile layer selector */}
          <div className="flex items-center bg-slate-800 rounded p-0.5 border border-slate-700">
            <button
              onClick={() => setActiveTileLayer('standard')}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                activeTileLayer === 'standard' ? 'bg-[#D71920] text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setActiveTileLayer('humanitarian')}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                activeTileLayer === 'humanitarian' ? 'bg-[#D71920] text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Humanitarian
            </button>
          </div>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div className="relative flex-1 w-full min-h-[360px] bg-[#f1f3f5]">
        <div ref={mapContainerRef} className="absolute inset-0 z-10 w-full h-full" />
      </div>

      {/* Map Legend Footer */}
      <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] flex items-center justify-between text-slate-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#111111] border border-white inline-block shadow-2xs" />
            <span>Approved Household Geopoint</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#f59e0b] border border-white inline-block shadow-2xs" />
            <span>Quality Warning / Outlier Alert</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#D71920] border border-white inline-block shadow-2xs" />
            <span>Selected Record</span>
          </div>
        </div>

        <span className="text-[10px] text-slate-500 font-mono">
          Tiles: OpenStreetMap contributors &middot; Leaflet v1.9.4
        </span>
      </div>
    </div>
  );
};
