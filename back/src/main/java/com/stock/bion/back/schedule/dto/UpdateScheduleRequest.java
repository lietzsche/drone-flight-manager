package com.stock.bion.back.schedule.dto;

import com.stock.bion.back.schedule.ScheduleStatus;

import java.time.LocalDateTime;

public record UpdateScheduleRequest(
        String title,
        String description,
        LocalDateTime startsAt,
        LocalDateTime endsAt,
        String locationName,
        Double lat,
        Double lng,
        ScheduleStatus status
) {}

