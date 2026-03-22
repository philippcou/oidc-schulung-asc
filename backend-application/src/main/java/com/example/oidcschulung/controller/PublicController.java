package com.example.oidcschulung.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/public")
@Tag(name = "Public", description = "Endpunkte ohne Authentifizierung")
public class PublicController {

    @GetMapping("/health")
    @Operation(summary = "Health Check", description = "Öffentlich zugänglich - kein Token erforderlich")
    public Map<String, String> health() {
        return Map.of("status", "UP", "service", "oidc-schulung-backend");
    }
}
