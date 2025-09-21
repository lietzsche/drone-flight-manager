import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L, {
  type Map as LeafletMap,
  type GeoJSON as LeafletGeoJSON,
  type FeatureGroup,
  type LeafletEventHandlerFn,
} from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

import { useFlightZones } from '../hooks/useFlightZones';
import type {
  FlightZone,
  FlightZoneType,
  FlightZonePayload,
  CreateFlightZonePayload,
} from '../api';

const typeColors: Record<FlightZoneType, string> = {
  PROHIBITED: '#ef4444',
  RESTRICTED: '#f97316',
  CAUTION: '#facc15',
};

type FormMode = 'new' | 'edit';

interface FormState {
  name: string;
  type: FlightZoneType;
  altitudeLimit: string;
  timeWindow: string;
  geojson: string;
}

type DrawHandlers = {
  created: LeafletEventHandlerFn;
  edited: LeafletEventHandlerFn;
  deleted: LeafletEventHandlerFn;
};

const initialForm: FormState = {
  name: '',
  type: 'PROHIBITED',
  altitudeLimit: '',
  timeWindow: '',
  geojson: '',
};

function MapReady({ onReady }: { onReady: (map: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

function extractPolygonGeometry(layer: L.Layer): GeoJsonObject {
  const raw = (layer as any).toGeoJSON();
  if (!raw) return { type: 'Polygon', coordinates: [] } as GeoJsonObject;
  return raw.type === 'Feature' ? raw.geometry : raw;
}

function disableActiveDraw(drawControl: L.Control.Draw | null) {
  const toolbar = (drawControl as any)?._toolbars?.draw;
  toolbar?.disable?.();
}

function enablePolygonDraw(drawControl: L.Control.Draw | null) {
  const toolbar = (drawControl as any)?._toolbars?.draw;
  const polygon = toolbar?._modes?.polygon?.handler as L.Draw.Polygon | undefined;
  if (!polygon) return;
  toolbar.disable?.();
  polygon.enable();
}

export default function FlightZonePage() {
  const { list, create, update, remove } = useFlightZones();
  const zones = list.data ?? [];

  const mapRef = useRef<LeafletMap | null>(null);
  const layerRefs = useRef<Map<number, LeafletGeoJSON>>(new Map());
  const drawnLayerRef = useRef<FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const drawHandlersRef = useRef<DrawHandlers | null>(null);
  const formModeRef = useRef<FormMode | null>(null);
  const isDrawingRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Record<FlightZoneType, boolean>>({
    PROHIBITED: true,
    RESTRICTED: true,
    CAUTION: true,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [formTargetId, setFormTargetId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const setDrawingInteractivity = useCallback(
    (drawing: boolean) => {
      const map = mapRef.current;
      if (!map) return;
      if (drawing) {
        if (isDrawingRef.current) return;
        isDrawingRef.current = true;
        map.dragging.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
        map.touchZoom.disable();
      } else {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        map.dragging.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        map.touchZoom.enable();
      }
    },
    [],
  );

  useEffect(() => {
    formModeRef.current = formMode;
  }, [formMode]);

  const parsedZones = useMemo(
    () =>
      zones
        .map((zone) => {
          try {
            const feature = JSON.parse(zone.geojson) as GeoJsonObject;
            return { zone, feature };
          } catch (err) {
            console.warn('Invalid geojson for zone', zone.id, err);
            return null;
          }
        })
        .filter((entry): entry is { zone: FlightZone; feature: GeoJsonObject } => entry !== null),
    [zones],
  );

  useEffect(() => {
    const ids = new Set(zones.map((z) => z.id));
    layerRefs.current.forEach((layer, id) => {
      if (!ids.has(id)) {
        layer.remove();
        layerRefs.current.delete(id);
      }
    });
  }, [zones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    parsedZones.forEach(({ zone }) => {
      const layer = layerRefs.current.get(zone.id);
      if (!layer) return;
      const visible = visibleTypes[zone.type];
      const attached = map.hasLayer(layer);
      if (visible && !attached) {
        layer.addTo(map);
      } else if (!visible && attached) {
        layer.remove();
      }
    });
  }, [parsedZones, visibleTypes]);

  useEffect(() => {
    parsedZones.forEach(({ zone }) => {
      const layer = layerRefs.current.get(zone.id);
      if (!layer) return;
      const visible = visibleTypes[zone.type];
      const highlight = zone.id === selectedId || zone.id === hoveredId;
      const color = highlight ? '#2563eb' : typeColors[zone.type];
      layer.setStyle({
        color,
        weight: highlight ? 3 : 1.5,
        fillColor: typeColors[zone.type],
        fillOpacity: visible ? (highlight ? 0.35 : 0.18) : 0,
        opacity: visible ? 1 : 0,
      });
      if (highlight && visible) {
        layer.bringToFront();
      }
    });
  }, [hoveredId, parsedZones, selectedId, visibleTypes]);

  const focusZone = useCallback((id: number) => {
    const layer = layerRefs.current.get(id);
    const map = mapRef.current;
    if (!layer || !map) return;
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    const zone = zones.find((z) => z.id === selectedId);
    if (!zone) return;
    if (!visibleTypes[zone.type]) return;
    focusZone(selectedId);
  }, [focusZone, selectedId, visibleTypes, zones]);

  const clearDrawnLayers = useCallback(() => {
    drawnLayerRef.current?.clearLayers();
  }, []);

  const loadPolygonToMap = useCallback((value?: string, options?: { fitBounds?: boolean }) => {
    const drawnGroup = drawnLayerRef.current;
    const map = mapRef.current;
    if (!drawnGroup || !map) return false;
    drawnGroup.clearLayers();
    if (!value) return true;
    try {
      const parsed = JSON.parse(value) as GeoJsonObject;
      const styled = L.geoJSON(parsed as any, {
        style: {
          color: '#2563eb',
          weight: 2,
          fillOpacity: 0.2,
        },
      });
      styled.eachLayer((layer) => {
        drawnGroup.addLayer(layer);
        if ((layer as any).editing && typeof (layer as any).editing.enable === 'function') {
          (layer as any).editing.enable();
        }
      });
      const bounds = drawnGroup.getBounds();
      if (bounds.isValid() && (options?.fitBounds ?? true)) {
        map.fitBounds(bounds, { padding: [24, 24] });
      }
      return true;
    } catch (err) {
      console.warn('Invalid GeoJSON string supplied to map', err);
      drawnGroup.clearLayers();
      return false;
    }
  }, []);

  const toggleType = (type: FlightZoneType) => {
    setVisibleTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const startPolygonDrawing = useCallback(() => {
    setDrawingInteractivity(true);
    enablePolygonDraw(drawControlRef.current);
  }, [setDrawingInteractivity]);

  const stopPolygonDrawing = useCallback(() => {
    disableActiveDraw(drawControlRef.current);
    setDrawingInteractivity(false);
  }, [setDrawingInteractivity]);

  const openNewForm = useCallback(() => {
    setFormMode('new');
    setForm({ ...initialForm });
    setFormTargetId(null);
    setFormError(null);
    clearDrawnLayers();
    startPolygonDrawing();
  }, [clearDrawnLayers, startPolygonDrawing]);

  const openEditForm = useCallback(
    (zone: FlightZone) => {
      let prettyGeo = zone.geojson;
      try {
        prettyGeo = JSON.stringify(JSON.parse(zone.geojson), null, 2);
      } catch (err) {
        console.warn('Failed to pretty-print geojson', err);
      }
      setFormMode('edit');
      setForm({
        name: zone.name,
        type: zone.type,
        altitudeLimit: zone.altitudeLimit != null ? String(zone.altitudeLimit) : '',
        timeWindow: zone.timeWindow ?? '',
        geojson: prettyGeo,
      });
      setFormTargetId(zone.id);
      setFormError(null);
      loadPolygonToMap(prettyGeo, { fitBounds: true });
      stopPolygonDrawing();
    },
    [loadPolygonToMap, stopPolygonDrawing],
  );

  const closeForm = useCallback(() => {
    setFormMode(null);
    setForm({ ...initialForm });
    setFormTargetId(null);
    setFormError(null);
    clearDrawnLayers();
    stopPolygonDrawing();
  }, [clearDrawnLayers, stopPolygonDrawing]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formMode) return;

    const name = form.name.trim();
    const timeValue = form.timeWindow.trim();
    const geojsonValue = form.geojson.trim();
    const altitudeRaw = form.altitudeLimit.trim();
    const altitudeLimit = altitudeRaw === '' ? undefined : Number(altitudeRaw);

    if (!name) {
      setFormError('이름을 입력해 주세요.');
      return;
    }
    if (!geojsonValue) {
      setFormError('GeoJSON 정보를 입력하거나 지도에 폴리곤을 그려 주세요.');
      return;
    }
    if (altitudeLimit !== undefined && Number.isNaN(altitudeLimit)) {
      setFormError('고도 제한은 숫자여야 합니다.');
      return;
    }

    const basePayload: FlightZonePayload = {
      name,
      type: form.type,
      altitudeLimit,
      timeWindow: timeValue === '' ? undefined : timeValue,
      geojson: geojsonValue,
    };

    try {
      setFormError(null);
      if (formMode === 'new') {
        await create.mutateAsync(basePayload as CreateFlightZonePayload);
      } else if (formTargetId != null) {
        await update.mutateAsync({ id: formTargetId, data: basePayload });
      }
      closeForm();
    } catch (err: any) {
      setFormError(err?.message || '저장에 실패했습니다.');
    }
  };

  const handleDelete = async (zone: FlightZone) => {
    if (!window.confirm(`"${zone.name}" 구역을 삭제할까요?`)) return;
    try {
      await remove.mutateAsync(zone.id);
      if (selectedId === zone.id) {
        setSelectedId(null);
      }
    } catch (err: any) {
      alert(err?.message || '삭제에 실패했습니다.');
    }
  };

  const handleGeojsonBlur = () => {
    if (!formMode) return;
    const ok = loadPolygonToMap(form.geojson, { fitBounds: false });
    if (!ok && form.geojson.trim()) {
      setFormError('GeoJSON 형식이 올바르지 않습니다.');
    } else {
      setFormError(null);
    }
  };

  const handleDrawCreated = useCallback(
    (event: L.DrawEvents.Created) => {
      const geometry = extractPolygonGeometry(event.layer);
      const drawnGroup = drawnLayerRef.current;
      if (!drawnGroup) return;

      drawnGroup.clearLayers();
      drawnGroup.addLayer(event.layer);
      if ((event.layer as any).editing && typeof (event.layer as any).editing.enable === 'function') {
        (event.layer as any).editing.enable();
      }

      if (!formModeRef.current) {
        setFormMode('new');
        setFormTargetId(null);
        setFormError(null);
        setForm({
          ...initialForm,
          geojson: JSON.stringify(geometry, null, 2),
        });
      } else {
        setForm((prev) => ({ ...prev, geojson: JSON.stringify(geometry, null, 2) }));
      }
      setFormError(null);
      stopPolygonDrawing();
    },
    [stopPolygonDrawing],
  );

  const handleDrawEdited = useCallback(
    (event: L.DrawEvents.Edited) => {
      if (!formModeRef.current) return;
      const layers = event.layers.getLayers();
      if (layers.length === 0) return;
      const geometry = extractPolygonGeometry(layers[0] as L.Layer);
      setForm((prev) => ({ ...prev, geojson: JSON.stringify(geometry, null, 2) }));
      setFormError(null);
    },
    [],
  );

  const handleDrawDeleted = useCallback(
    (_event: L.DrawEvents.Deleted) => {
      if (!formModeRef.current) return;
      clearDrawnLayers();
      setForm((prev) => ({ ...prev, geojson: '' }));
    },
    [clearDrawnLayers],
  );

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const previous = drawHandlersRef.current;
    if (previous) {
      map.off(L.Draw.Event.CREATED, previous.created);
      map.off(L.Draw.Event.EDITED, previous.edited);
      map.off(L.Draw.Event.DELETED, previous.deleted);
    }

    const handlers: DrawHandlers = {
      created: (evt) => handleDrawCreated(evt as L.DrawEvents.Created),
      edited: (evt) => handleDrawEdited(evt as L.DrawEvents.Edited),
      deleted: (evt) => handleDrawDeleted(evt as L.DrawEvents.Deleted),
    };

    drawHandlersRef.current = handlers;

    map.on(L.Draw.Event.CREATED, handlers.created);
    map.on(L.Draw.Event.EDITED, handlers.edited);
    map.on(L.Draw.Event.DELETED, handlers.deleted);

    return () => {
      map.off(L.Draw.Event.CREATED, handlers.created);
      map.off(L.Draw.Event.EDITED, handlers.edited);
      map.off(L.Draw.Event.DELETED, handlers.deleted);
    };
  }, [handleDrawCreated, handleDrawDeleted, handleDrawEdited, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const onStart = () => setDrawingInteractivity(true);
    const onStop = () => setDrawingInteractivity(false);
    map.on(L.Draw.Event.DRAWSTART, onStart);
    map.on(L.Draw.Event.DRAWSTOP, onStop);
    return () => {
      map.off(L.Draw.Event.DRAWSTART, onStart);
      map.off(L.Draw.Event.DRAWSTOP, onStop);
    };
  }, [mapReady, setDrawingInteractivity]);

  const initializeDrawing = useCallback(
    (map: LeafletMap) => {
      mapRef.current = map;

      let drawnGroup = drawnLayerRef.current;
      if (!drawnGroup) {
        drawnGroup = new L.FeatureGroup();
        drawnLayerRef.current = drawnGroup;
      }
      if (!map.hasLayer(drawnGroup)) {
        map.addLayer(drawnGroup);
      }

      if (!drawControlRef.current) {
        const drawControl = new L.Control.Draw({
          draw: {
            polygon: {
              allowIntersection: false,
              showArea: true,
              shapeOptions: {
                color: '#2563eb',
              },
              repeatMode: true,
            },
            polyline: false,
            rectangle: false,
            circle: false,
            marker: false,
            circlemarker: false,
          },
          edit: {
            featureGroup: drawnGroup,
          },
        });
        drawControlRef.current = drawControl;
        map.addControl(drawControl);
      }

      setMapReady(true);
    },
    []);

  useEffect(() => {
    return () => {
      setDrawingInteractivity(false);
      const map = mapRef.current;
      if (!map) return;
      const handlers = drawHandlersRef.current;
      if (handlers) {
        map.off(L.Draw.Event.CREATED, handlers.created);
        map.off(L.Draw.Event.EDITED, handlers.edited);
        map.off(L.Draw.Event.DELETED, handlers.deleted);
      }
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
        drawControlRef.current = null;
      }
      if (drawnLayerRef.current) {
        map.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
      }
    };
  }, [setDrawingInteractivity]);

  const isSaving = create.isPending || update.isPending;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Flight Zones</h1>
        <button className="bg-blue-600 text-white text-sm px-3 py-1 rounded" onClick={openNewForm}>
          New Zone
        </button>
      </header>
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="relative h-[520px] overflow-hidden rounded shadow">
          <MapContainer center={[37.5665, 126.978]} zoom={8} style={{ height: '100%', width: '100%' }}>
            <MapReady onReady={initializeDrawing} />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {parsedZones.map(({ zone, feature }) => (
              <GeoJSON
                key={zone.id}
                data={feature}
                ref={(layer) => {
                  if (layer) {
                    layerRefs.current.set(zone.id, layer);
                  } else {
                    layerRefs.current.delete(zone.id);
                  }
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedId(zone.id);
                    focusZone(zone.id);
                  },
                  mouseover: () => setHoveredId(zone.id),
                  mouseout: () => setHoveredId((prev) => (prev === zone.id ? null : prev)),
                }}
                onEachFeature={(_, layer) => {
                  layer.bindTooltip(`${zone.name} (${zone.type})`, { sticky: true });
                }}
              />
            ))}
          </MapContainer>
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur rounded border shadow p-3 text-sm space-y-2">
            <div className="font-semibold">Legend</div>
            {Object.entries(typeColors).map(([type, color]) => (
              <label key={type} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibleTypes[type as FlightZoneType]}
                  onChange={() => toggleType(type as FlightZoneType)}
                />
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: color }} />
                  {type}
                </span>
              </label>
            ))}
            <p className="text-xs text-gray-500">
              "New Zone"을 누른 뒤 지도 위를 차례로 클릭해 다각형을 그릴 수 있습니다. 마지막 점에서 더블 클릭하거나 첫 점을 다시 클릭하면 폴리곤이 닫힙니다.
            </p>
            <p className="text-xs text-gray-500">Hover rows or shapes to highlight, click to zoom.</p>
          </div>
        </div>
        <div className="bg-white rounded shadow p-3 flex flex-col">
          <h2 className="text-lg font-medium mb-2">Zone List</h2>
          {list.isLoading && <p className="text-sm text-gray-500">Loading zones...</p>}
          {list.error && (
            <p className="text-sm text-red-600">{(list.error as any).message || 'Failed to load zones'}</p>
          )}
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Altitude</th>
                  <th className="text-left px-3 py-2">Time</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => {
                  const active = zone.id === selectedId || zone.id === hoveredId;
                  return (
                    <tr
                      key={zone.id}
                      className={`${active ? 'bg-blue-50' : ''} border-t cursor-pointer`}
                      onClick={() => {
                        setSelectedId(zone.id);
                        focusZone(zone.id);
                      }}
                      onMouseEnter={() => setHoveredId(zone.id)}
                      onMouseLeave={() => setHoveredId((prev) => (prev === zone.id ? null : prev))}
                    >
                      <td className="px-3 py-2 font-medium">{zone.name}</td>
                      <td className="px-3 py-2">{zone.type}</td>
                      <td className="px-3 py-2">{zone.altitudeLimit ?? '--'}</td>
                      <td className="px-3 py-2">{zone.timeWindow || '--'}</td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button
                          className="text-blue-600 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditForm(zone);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-red-600 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(zone);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {zones.length === 0 && !list.isLoading && (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                      No flight zones yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {formMode && (
        <div className="fixed inset-0 z-[2000] pointer-events-none">
          <div className="absolute inset-0 bg-black/60 pointer-events-none" aria-hidden="true" />
          <div className="absolute inset-0 flex items-center justify-center">
            <form
              className="bg-white rounded shadow-lg w-full max-w-lg p-5 space-y-3 pointer-events-auto"
              onSubmit={handleSubmit}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  {formMode === 'new' ? 'Create Flight Zone' : 'Edit Flight Zone'}
                </h3>
                <button
                  type="button"
                  className="text-sm text-gray-500 hover:text-gray-700"
                  onClick={closeForm}
                  aria-label="Close form"
                >
                  ×
                </button>
              </div>
              <div>
                <label className="block text-sm text-gray-600">Name</label>
                <input
                  className="border rounded w-full px-3 py-2"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Type</label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={form.type}
                  onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as FlightZoneType }))}
                  required
                >
                  <option value="PROHIBITED">PROHIBITED</option>
                  <option value="RESTRICTED">RESTRICTED</option>
                  <option value="CAUTION">CAUTION</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600">Altitude Limit (m)</label>
                  <input
                    type="number"
                    min="0"
                    className="border rounded w-full px-3 py-2"
                    value={form.altitudeLimit}
                    onChange={(event) => setForm((prev) => ({ ...prev, altitudeLimit: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Time Window</label>
                  <input
                    className="border rounded w-full px-3 py-2"
                    placeholder="예: 09:00-18:00"
                    value={form.timeWindow}
                    onChange={(event) => setForm((prev) => ({ ...prev, timeWindow: event.target.value }))}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-600">GeoJSON (Polygon)</label>
                  <span className="text-[11px] text-gray-500">지도에 그리면 자동으로 채워집니다.</span>
                </div>
                <textarea
                  className="border rounded w-full px-3 py-2 h-40 font-mono text-xs"
                  value={form.geojson}
                  onChange={(event) => setForm((prev) => ({ ...prev, geojson: event.target.value }))}
                  onBlur={handleGeojsonBlur}
                  placeholder='{ "type": "Polygon", "coordinates": [...] }'
                  required
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="px-3 py-1 text-sm" onClick={closeForm}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
