package com.stock.bion.back.user;

public record UserRegistrationRequest(
        String username,
        String password,
        String confirmPassword,
        String email,
        String phone) {
}
