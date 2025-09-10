package com.stock.bion.back.schedule;

import com.stock.bion.back.schedule.dto.CreateScheduleRequest;
import com.stock.bion.back.schedule.dto.UpdateScheduleRequest;
import com.stock.bion.back.schedule.dto.UpdateStatusRequest;
import com.stock.bion.back.user.User;
import com.stock.bion.back.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import com.stock.bion.back.common.PageResponse;

@RestController
@RequestMapping("/api/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final FlightScheduleRepository scheduleRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @PageableDefault(size = 50) Pageable pageable
    ) {
        if (from == null || to == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "from and to are required"));
        }
        if (!from.isBefore(to)) {
            return ResponseEntity.badRequest().body(Map.of("message", "from must be before to"));
        }
        Page<FlightSchedule> page = scheduleRepository.findOverlapping(from, to, pageable);
        PageResponse<FlightSchedule> dto = new PageResponse<>(
                page.getContent(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.getSize(),
                page.getNumber()
        );
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        Optional<FlightSchedule> opt = scheduleRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        return ResponseEntity.ok(opt.get());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateScheduleRequest req, Authentication authentication) {
        if (authentication == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (req == null || req.title() == null || req.title().isBlank() || req.startsAt() == null || req.endsAt() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "title, startsAt, endsAt are required"));
        }
        if (!req.startsAt().isBefore(req.endsAt())) {
            return ResponseEntity.badRequest().body(Map.of("message", "startsAt must be before endsAt"));
        }
        if (req.lat() != null && (req.lat() < -90 || req.lat() > 90)) {
            return ResponseEntity.badRequest().body(Map.of("message", "lat must be between -90 and 90"));
        }
        if (req.lng() != null && (req.lng() < -180 || req.lng() > 180)) {
            return ResponseEntity.badRequest().body(Map.of("message", "lng must be between -180 and 180"));
        }

        User owner = userRepository.findByUsername(authentication.getName());
        if (owner == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        FlightSchedule s = new FlightSchedule();
        s.setOwnerId(owner.getId());
        s.setTitle(req.title());
        s.setDescription(req.description());
        s.setStartsAt(req.startsAt());
        s.setEndsAt(req.endsAt());
        s.setLocationName(req.locationName());
        s.setLat(req.lat());
        s.setLng(req.lng());
        s.setStatus(req.status() != null ? req.status() : ScheduleStatus.PLANNED);

        FlightSchedule saved = scheduleRepository.save(s);
        return ResponseEntity.created(URI.create("/api/schedules/" + saved.getId())).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @RequestBody UpdateScheduleRequest req,
                                    Authentication authentication) {
        Optional<FlightSchedule> opt = scheduleRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        FlightSchedule s = opt.get();
        if (!canModify(s, authentication)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        if (req.startsAt() != null && req.endsAt() != null && !req.startsAt().isBefore(req.endsAt())) {
            return ResponseEntity.badRequest().body(Map.of("message", "startsAt must be before endsAt"));
        }
        if (req.lat() != null && (req.lat() < -90 || req.lat() > 90)) {
            return ResponseEntity.badRequest().body(Map.of("message", "lat must be between -90 and 90"));
        }
        if (req.lng() != null && (req.lng() < -180 || req.lng() > 180)) {
            return ResponseEntity.badRequest().body(Map.of("message", "lng must be between -180 and 180"));
        }

        if (req.title() != null && !req.title().isBlank()) s.setTitle(req.title());
        if (req.description() != null) s.setDescription(req.description());
        if (req.startsAt() != null) s.setStartsAt(req.startsAt());
        if (req.endsAt() != null) s.setEndsAt(req.endsAt());
        if (req.locationName() != null) s.setLocationName(req.locationName());
        if (req.lat() != null) s.setLat(req.lat());
        if (req.lng() != null) s.setLng(req.lng());
        if (req.status() != null) s.setStatus(req.status());

        return ResponseEntity.ok(scheduleRepository.save(s));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id,
                                          @RequestBody UpdateStatusRequest req,
                                          Authentication authentication) {
        Optional<FlightSchedule> opt = scheduleRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        FlightSchedule s = opt.get();
        if (!canModify(s, authentication)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        if (req == null || req.status() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "status is required"));
        }
        s.setStatus(req.status());
        return ResponseEntity.ok(scheduleRepository.save(s));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, Authentication authentication) {
        Optional<FlightSchedule> opt = scheduleRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        FlightSchedule s = opt.get();
        if (!canModify(s, authentication)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        scheduleRepository.delete(s);
        return ResponseEntity.noContent().build();
    }

    private boolean canModify(FlightSchedule s, Authentication authentication) {
        if (authentication == null) return false;
        // owner or ADMIN
        User current = userRepository.findByUsername(authentication.getName());
        if (current == null) return false;
        boolean isOwner = s.getOwnerId() != null && s.getOwnerId().equals(current.getId());
        boolean isAdmin = authentication.getAuthorities() != null && authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return isOwner || isAdmin;
    }
}
