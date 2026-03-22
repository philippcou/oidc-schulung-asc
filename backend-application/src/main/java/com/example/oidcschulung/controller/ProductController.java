package com.example.oidcschulung.controller;

import com.example.oidcschulung.model.Product;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@RestController
@RequestMapping("/api/products")
@Tag(name = "Products", description = "Produktverwaltung - zeigt rollenbasierte Zugriffskontrolle")
@SecurityRequirement(name = "keycloak")
public class ProductController {

    private final List<Product> products = new ArrayList<>(List.of(
        new Product(1L, "Laptop", "Entwickler-Laptop 16\"", 1499.99),
        new Product(2L, "Maus", "Ergonomische Maus", 59.99),
        new Product(3L, "Tastatur", "Mechanische Tastatur", 129.99)
    ));

    private final AtomicLong idCounter = new AtomicLong(4);

    @GetMapping
    @PreAuthorize("hasAnyRole('BASIC', 'ADMIN')")
    @Operation(summary = "Alle Produkte", description = "Erfordert Rolle **BASIC** oder **ADMIN**")
    public List<Product> getAll() {
        return products;
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('BASIC', 'ADMIN')")
    @Operation(summary = "Produkt nach ID", description = "Erfordert Rolle **BASIC** oder **ADMIN**")
    public ResponseEntity<Product> getById(@PathVariable Long id) {
        return products.stream()
            .filter(p -> p.id().equals(id))
            .findFirst()
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Produkt anlegen", description = "Nur für Nutzer mit Rolle **ADMIN**")
    public Product create(@RequestBody Product product) {
        Product created = new Product(idCounter.getAndIncrement(), product.name(), product.description(), product.price());
        products.add(created);
        return created;
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Produkt löschen", description = "Nur für Nutzer mit Rolle **ADMIN**")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        boolean removed = products.removeIf(p -> p.id().equals(id));
        return removed ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
