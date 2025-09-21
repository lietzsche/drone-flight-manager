package com.stock.bion.back.zone;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stock.bion.back.zone.dto.FlightZoneRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/flight-zones")
@RequiredArgsConstructor
public class FlightZoneController {

    private final FlightZoneRepository zoneRepository;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<List<FlightZone>> list() {
        List<FlightZone> zones = zoneRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
        return ResponseEntity.ok(zones);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        Optional<FlightZone> opt = zoneRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Flight zone not found"));
        }
        return ResponseEntity.ok(opt.get());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody FlightZoneRequest req) {
        String error = validateRequest(req, true);
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("message", error));
        }
        FlightZone zone = new FlightZone();
        apply(zone, req);
        FlightZone saved = zoneRepository.save(zone);
        return ResponseEntity.created(URI.create("/api/flight-zones/" + saved.getId())).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody FlightZoneRequest req) {
        Optional<FlightZone> opt = zoneRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Flight zone not found"));
        }
        String error = validateRequest(req, false);
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("message", error));
        }
        FlightZone zone = opt.get();
        apply(zone, req);
        FlightZone saved = zoneRepository.save(zone);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        Optional<FlightZone> opt = zoneRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Flight zone not found"));
        }
        zoneRepository.delete(opt.get());
        return ResponseEntity.noContent().build();
    }

    private void apply(FlightZone zone, FlightZoneRequest req) {
        if (req.name() != null) zone.setName(req.name().trim());
        if (req.type() != null) zone.setType(req.type());
        if (req.altitudeLimit() != null) zone.setAltitudeLimit(req.altitudeLimit());
        if (req.timeWindow() != null) zone.setTimeWindow(req.timeWindow().trim());
        if (req.geojson() != null) zone.setGeojson(req.geojson().trim());
    }

    private String validateRequest(FlightZoneRequest req, boolean isCreate) {
        if (req == null) {
            return "Request body is required";
        }
        if (isCreate || req.name() != null) {
            if (req.name() == null || req.name().isBlank()) {
                return "name is required";
            }
        }
        if (isCreate || req.type() != null) {
            if (req.type() == null) {
                return "type is required";
            }
        }
        if (req.altitudeLimit() != null && req.altitudeLimit() < 0) {
            return "altitudeLimit must be 0 or greater";
        }
        if (req.timeWindow() != null && req.timeWindow().length() > 255) {
            return "timeWindow is too long";
        }
        if (isCreate || req.geojson() != null) {
            String geo = req.geojson();
            if (geo == null || geo.isBlank()) {
                return "geojson is required";
            }
            String message = validateGeoJson(geo);
            if (message != null) {
                return message;
            }
        }
        return null;
    }

    private String validateGeoJson(String geojson) {
        try {
            JsonNode root = objectMapper.readTree(geojson);
            JsonNode typeNode = root.get("type");
            if (typeNode == null || !"Polygon".equalsIgnoreCase(typeNode.asText())) {
                return "geojson must be a Polygon";
            }
            JsonNode coordsNode = root.get("coordinates");
            if (coordsNode == null || !coordsNode.isArray() || coordsNode.isEmpty()) {
                return "geojson coordinates are missing";
            }
            JsonNode outerRing = coordsNode.get(0);
            if (outerRing == null || !outerRing.isArray() || outerRing.size() < 4) {
                return "Polygon requires at least four coordinates";
            }
            List<Point> points = new ArrayList<>();
            for (JsonNode node : outerRing) {
                if (!node.isArray() || node.size() < 2) {
                    return "Each coordinate must contain [lng, lat]";
                }
                double lng = node.get(0).asDouble();
                double lat = node.get(1).asDouble();
                points.add(new Point(lng, lat));
            }
            if (!samePoint(points.get(0), points.get(points.size() - 1))) {
                points.add(points.get(0));
            }
            if (hasSelfIntersection(points)) {
                return "Polygon must not self-intersect";
            }
        } catch (JsonProcessingException e) {
            return "geojson must be valid JSON";
        }
        return null;
    }

    private boolean hasSelfIntersection(List<Point> pts) {
        int n = pts.size();
        for (int i = 0; i < n - 1; i++) {
            Point a1 = pts.get(i);
            Point a2 = pts.get(i + 1);
            for (int j = i + 1; j < n - 1; j++) {
                if (Math.abs(i - j) <= 1) continue;
                if (i == 0 && j == n - 2) continue;
                Point b1 = pts.get(j);
                Point b2 = pts.get(j + 1);
                if (segmentsIntersect(a1, a2, b1, b2)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean segmentsIntersect(Point p1, Point p2, Point p3, Point p4) {
        int o1 = orientation(p1, p2, p3);
        int o2 = orientation(p1, p2, p4);
        int o3 = orientation(p3, p4, p1);
        int o4 = orientation(p3, p4, p2);

        if (o1 != o2 && o3 != o4) return true;

        if (o1 == 0 && onSegment(p1, p2, p3)) return true;
        if (o2 == 0 && onSegment(p1, p2, p4)) return true;
        if (o3 == 0 && onSegment(p3, p4, p1)) return true;
        if (o4 == 0 && onSegment(p3, p4, p2)) return true;

        return false;
    }

    private int orientation(Point a, Point b, Point c) {
        double val = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        if (Math.abs(val) < 1e-9) return 0;
        return val > 0 ? 1 : -1;
    }

    private boolean onSegment(Point a, Point b, Point c) {
        return c.x <= Math.max(a.x, b.x) + 1e-9 && c.x + 1e-9 >= Math.min(a.x, b.x)
                && c.y <= Math.max(a.y, b.y) + 1e-9 && c.y + 1e-9 >= Math.min(a.y, b.y);
    }

    private boolean samePoint(Point a, Point b) {
        return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
    }

    private record Point(double x, double y) {}
}

