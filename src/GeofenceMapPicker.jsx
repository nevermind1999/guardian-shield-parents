import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { X, Trash2 } from 'lucide-react';

// Corrige o ícone padrão do marcador do Leaflet, que quebra com o bundler do Vite
// (o caminho relativo embutido no CSS do pacote não sobrevive ao build).
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

// Componente sem UI própria: só escuta clique no mapa e reporta a coordenada pro pai.
function ClickToPlace({ onPick }) {
  useMapEvents({
    click(e) { onPick(e.latlng); }
  });
  return null;
}

const RADIUS_MIN = 50;
const RADIUS_MAX = 1000;

/**
 * Modal de criar/editar uma cerca virtual: mapa clicável (ou arrastar o marcador)
 * pra escolher o ponto, slider de raio, nome livre com atalhos "Casa"/"Escola".
 * `geofence` null = criar nova; objeto existente = editar (mostra botão excluir).
 */
export default function GeofenceMapPicker({ geofence, defaultCenter, onSave, onDelete, onClose }) {
  const [name, setName] = useState(geofence?.name || '');
  const [radiusMeters, setRadiusMeters] = useState(geofence?.radiusMeters || 150);
  const [position, setPosition] = useState({
    lat: geofence?.latitude ?? defaultCenter?.lat ?? -23.550520,
    lng: geofence?.longitude ?? defaultCenter?.lng ?? -46.633308
  });

  const handleSave = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: geofence?.id,
      name: name.trim(),
      latitude: position.lat,
      longitude: position.lng,
      radiusMeters: Number(radiusMeters)
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'var(--overlay-scrim)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div className="glass-panel" style={{ padding: '24px', maxWidth: '460px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{geofence ? 'Editar Cerca' : 'Nova Cerca Virtual'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Toque no mapa (ou arraste o marcador) para escolher o ponto central da cerca.
        </p>

        <div style={{ height: '260px', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
          <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickToPlace onPick={(latlng) => setPosition({ lat: latlng.lat, lng: latlng.lng })} />
            <Marker
              position={position}
              draggable
              eventHandlers={{ dragend: (e) => setPosition(e.target.getLatLng()) }}
            />
            <Circle center={position} radius={radiusMeters} pathOptions={{ color: '#3b82f6', fillOpacity: 0.15 }} />
          </MapContainer>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Nome da cerca
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setName('Casa')}>
                🏠 Casa
              </button>
              <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setName('Escola')}>
                🏫 Escola
              </button>
            </div>
            <input
              type="text"
              placeholder="ex: Casa da vó"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px',
                border: '1px solid var(--border-color)', background: 'var(--surface-2)',
                color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <span>Raio da cerca</span>
              <strong style={{ color: 'var(--text-primary)' }}>{radiusMeters}m</strong>
            </label>
            <input
              type="range"
              min={RADIUS_MIN}
              max={RADIUS_MAX}
              step={10}
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            {geofence && (
              <button
                type="button"
                className="btn btn-danger"
                style={{ padding: '10px 14px' }}
                onClick={() => onDelete(geofence.id)}
                title="Excluir cerca"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
