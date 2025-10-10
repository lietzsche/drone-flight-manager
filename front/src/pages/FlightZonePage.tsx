import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L, {
  type Map as LeafletMap,
  type GeoJSON as LeafletGeoJSON,
  type FeatureGroup,
  type LeafletEventHandlerFn,
} from 'leaflet';
import type { GeoJsonObject, Polygon as GeoJsonPolygon } from 'geojson';
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

type SimplePoint = [number, number];

const GEOMETRY_EPSILON = 1e-10;

function toPolygonGeometry(data: unknown): GeoJsonPolygon | null {
  if (!data || typeof data !== 'object') return null;
  const typed = data as { type?: string; geometry?: unknown; coordinates?: unknown };
  if (typed.type === 'Feature') {
    return toPolygonGeometry(typed.geometry);
  }
  if (typed.type === 'Polygon' && Array.isArray(typed.coordinates)) {
    return typed as GeoJsonPolygon;
  }
  return null;
}

function parsePolygonGeojson(value: string): GeoJsonPolygon | null {
  try {
    const parsed = JSON.parse(value) as GeoJsonObject;
    return toPolygonGeometry(parsed);
  } catch {
    return null;
  }
}

function pointsEqual(a: SimplePoint, b: SimplePoint): boolean {
  return Math.abs(a[0] - b[0]) < GEOMETRY_EPSILON && Math.abs(a[1] - b[1]) < GEOMETRY_EPSILON;
}

function onSegment(p: SimplePoint, q: SimplePoint, r: SimplePoint): boolean {
  return (
    q[0] <= Math.max(p[0], r[0]) + GEOMETRY_EPSILON &&
    q[0] >= Math.min(p[0], r[0]) - GEOMETRY_EPSILON &&
    q[1] <= Math.max(p[1], r[1]) + GEOMETRY_EPSILON &&
    q[1] >= Math.min(p[1], r[1]) - GEOMETRY_EPSILON
  );
}

function orientation(p: SimplePoint, q: SimplePoint, r: SimplePoint): number {
  const value = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (Math.abs(value) < GEOMETRY_EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

function segmentsIntersect(p1: SimplePoint, p2: SimplePoint, q1: SimplePoint, q2: SimplePoint): boolean {
  const o1 = orientation(p1, p2, q1);
  const o2 = orientation(p1, p2, q2);
  const o3 = orientation(q1, q2, p1);
  const o4 = orientation(q1, q2, p2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, q1, p2)) return true;
  if (o2 === 0 && onSegment(p1, q2, p2)) return true;
  if (o3 === 0 && onSegment(q1, p1, q2)) return true;
  if (o4 === 0 && onSegment(q1, p2, q2)) return true;
  return false;
}

function polygonArea(points: SimplePoint[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) * 0.5;
}

function normalizeRing(rawRing: unknown[]): SimplePoint[] | null {
  const points: SimplePoint[] = [];
  for (const rawPoint of rawRing) {
    if (!Array.isArray(rawPoint) || rawPoint.length < 2) return null;
    const lng = rawPoint[0];
    const lat = rawPoint[1];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    points.push([lng, lat]);
  }

  if (points.length < 3) return null;

  if (pointsEqual(points[0], points[points.length - 1])) {
    points.pop();
  }

  if (points.length < 3) return null;

  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    if (pointsEqual(points[index], next)) {
      return null;
    }
  }

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (pointsEqual(points[i], points[j])) {
        return null;
      }
    }
  }

  return points;
}

function isSimplePolygon(geometry: GeoJsonPolygon): boolean {
  const ring = geometry.coordinates?.[0];
  if (!Array.isArray(ring)) return false;

  const points = normalizeRing(ring);
  if (!points || points.length < 3) return false;

  if (polygonArea(points) < GEOMETRY_EPSILON) {
    return false;
  }

  const segmentCount = points.length;
  for (let i = 0; i < segmentCount; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % segmentCount];
    for (let j = i + 1; j < segmentCount; j += 1) {
      if (Math.abs(i - j) <= 1) continue;
      if (i === 0 && j === segmentCount - 1) continue;
      const b1 = points[j];
      const b2 = points[(j + 1) % segmentCount];
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return false;
      }
    }
  }

  return true;
}

function extractPolygonGeometry(layer: L.Layer): GeoJsonPolygon | null {
  const raw = (layer as any).toGeoJSON() as GeoJsonObject | undefined;
  if (!raw) return null;
  return toPolygonGeometry(raw);
}

function MapReady({ onReady }: { onReady: (map: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
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
          const feature = parsePolygonGeojson(zone.geojson);
          if (!feature) {
            console.warn('Invalid polygon geojson for zone', zone.id);
            return null;
          }
          return { zone, feature };
        })
        .filter((entry): entry is { zone: FlightZone; feature: GeoJsonPolygon } => entry !== null),
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
    const geometry = parsePolygonGeojson(value);
    if (!geometry) {
      console.warn('Invalid polygon GeoJSON string supplied to map');
      drawnGroup.clearLayers();
      return false;
    }
    const styled = L.geoJSON(geometry as GeoJsonObject, {
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
      const geometry = parsePolygonGeojson(zone.geojson);
      const prettyGeo = geometry ? JSON.stringify(geometry, null, 2) : zone.geojson;
      if (!geometry) {
        console.warn('Failed to parse polygon geojson for zone', zone.id);
      }
      const initialError = !geometry
        ? '저장된 폴리곤 데이터를 불러오지 못했습니다. 지도에서 다시 그려 주세요.'
        : isSimplePolygon(geometry)
          ? null
          : '다각형 선들이 서로 교차하지 않도록 수정해 주세요.';
      setFormMode('edit');
      setForm({
        name: zone.name,
        type: zone.type,
        altitudeLimit: zone.altitudeLimit != null ? String(zone.altitudeLimit) : '',
        timeWindow: zone.timeWindow ?? '',
        geojson: prettyGeo,
      });
      setFormTargetId(zone.id);
      setFormError(initialError);
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
      setFormError('지도에서 폴리곤을 그려 주세요.');
      return;
    }
    if (altitudeLimit !== undefined && Number.isNaN(altitudeLimit)) {
      setFormError('고도 제한은 숫자여야 합니다.');
      return;
    }

    const geometry = parsePolygonGeojson(geojsonValue);
    if (!geometry) {
      setFormError('그린 영역 정보를 불러올 수 없습니다. 지도를 다시 그려 주세요.');
      return;
    }
    if (!isSimplePolygon(geometry)) {
      setFormError('다각형 선들이 서로 교차하지 않도록 수정해 주세요.');
      return;
    }

    const basePayload: FlightZonePayload = {
      name,
      type: form.type,
      altitudeLimit,
      timeWindow: timeValue === '' ? undefined : timeValue,
      geojson: JSON.stringify(geometry),
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

  const handleDrawCreated = useCallback(
    (event: L.DrawEvents.Created) => {
      const drawnGroup = drawnLayerRef.current;
      if (!drawnGroup) return;

      const geometry = extractPolygonGeometry(event.layer);
      if (!geometry) {
        setForm((prev) => ({ ...prev, geojson: '' }));
        setFormError('폴리곤 정보를 읽을 수 없습니다. 다시 시도해 주세요.');
        stopPolygonDrawing();
        return;
      }

      drawnGroup.clearLayers();
      drawnGroup.addLayer(event.layer);
      if ((event.layer as any).editing && typeof (event.layer as any).editing.enable === 'function') {
        (event.layer as any).editing.enable();
      }

      const pretty = JSON.stringify(geometry, null, 2);
      const simpleError = isSimplePolygon(geometry)
        ? null
        : '다각형 선들이 서로 교차하지 않도록 수정해 주세요.';

      if (!formModeRef.current) {
        setFormMode('new');
        setFormTargetId(null);
        setForm({
          ...initialForm,
          geojson: pretty,
        });
      } else {
        setForm((prev) => ({ ...prev, geojson: pretty }));
      }
      setFormError(simpleError);
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
      if (!geometry) {
        setFormError('편집한 폴리곤을 읽을 수 없습니다. 다시 시도해 주세요.');
        return;
      }
      setForm((prev) => ({ ...prev, geojson: JSON.stringify(geometry, null, 2) }));
      setFormError(
        isSimplePolygon(geometry) ? null : '다각형 선들이 서로 교차하지 않도록 수정해 주세요.',
      );
    },
    [],
  );

  const handleDrawDeleted = useCallback(
    (_event: L.DrawEvents.Deleted) => {
      if (!formModeRef.current) return;
      clearDrawnLayers();
      setForm((prev) => ({ ...prev, geojson: '' }));
      setFormError('지도에서 폴리곤을 다시 그려 주세요.');
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
              allowIntersection: true,
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
              <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                지도를 클릭해 영역을 그리고 마지막 꼭짓점에서 더블 클릭하면 그리기가 완료됩니다. 표시된 점을 드래그해서 언제든지 모양을 조정할 수 있어요.
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
