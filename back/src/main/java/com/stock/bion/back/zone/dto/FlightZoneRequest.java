package com.stock.bion.back.zone.dto;

import com.stock.bion.back.zone.FlightZoneType;

public record FlightZoneRequest(
        String name,
        FlightZoneType type,
        Integer altitudeLimit,
        String timeWindow,
        String geojson
) {}

