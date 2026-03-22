package com.example.oidcschulung.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.OAuthFlow;
import io.swagger.v3.oas.annotations.security.OAuthFlows;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
    info = @Info(
        title = "OIDC Schulung - Demo API",
        version = "1.0",
        description = "Beispiel Resource Server für die OIDC Schulung"
    )
)
@SecurityScheme(
    name = "keycloak",
    type = SecuritySchemeType.OAUTH2,
    flows = @OAuthFlows(
        authorizationCode = @OAuthFlow(
            authorizationUrl = "http://localhost:8080/realms/test-realm/protocol/openid-connect/auth",
            tokenUrl = "http://localhost:8080/realms/test-realm/protocol/openid-connect/token"
        )
    )
)
public class OpenApiConfig {
}
