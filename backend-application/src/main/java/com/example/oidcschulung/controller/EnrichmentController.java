package com.example.oidcschulung.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Interner Endpunkt für den Keycloak Protocol Mapper.
 *
 * Wird während der Token-Ausstellung von Keycloak aufgerufen, um Token-Claims
 * mit business-spezifischen Nutzer-Daten anzureichern.
 * Kein JWT erforderlich - der Aufruf kommt intern aus dem Keycloak-Container.
 */
@RestController
@RequestMapping("/api/internal")
public class EnrichmentController {

    private static final String COMPANY = "Aschauer IT & Business GmbH";

    public record UserEnrichment(
            String department,
            String employeeId,
            String company,
            String enrichedBy
    ) {}

    private static final UserEnrichment DEFAULT =
            new UserEnrichment("Development", "001", COMPANY, "oidc-schulung-backend");

    @GetMapping("/enrich/{username}")
    public UserEnrichment enrich(@PathVariable String username) {
        return DEFAULT;
    }
}
