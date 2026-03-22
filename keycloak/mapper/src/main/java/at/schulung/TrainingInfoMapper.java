package at.schulung;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.keycloak.models.ClientSessionContext;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.ProtocolMapperModel;
import org.keycloak.models.UserSessionModel;
import org.keycloak.protocol.oidc.mappers.AbstractOIDCProtocolMapper;
import org.keycloak.protocol.oidc.mappers.OIDCAccessTokenMapper;
import org.keycloak.protocol.oidc.mappers.OIDCAttributeMapperHelper;
import org.keycloak.protocol.oidc.mappers.OIDCIDTokenMapper;
import org.keycloak.protocol.oidc.mappers.UserInfoTokenMapper;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.representations.IDToken;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Custom Protocol Mapper für die OIDC-Schulung.
 *
 * Fügt zwei Claims zum Token hinzu:
 *   training_context - Session-Metadaten (login_time, session_id, auth_method)
 *     └─ user_enrichment - Business-Daten vom Backend (department, employeeId, …)
 *
 * Ziel: zeigen, dass Keycloak während der Token-Ausstellung externe Dienste
 * aufrufen kann, um Claims dynamisch anzureichern.
 */
public class TrainingInfoMapper extends AbstractOIDCProtocolMapper
        implements OIDCAccessTokenMapper, OIDCIDTokenMapper, UserInfoTokenMapper {

    public static final String PROVIDER_ID = "training-info-mapper";

    private static final String BACKEND_URL_PROPERTY = "backend.url";
    private static final String BACKEND_URL_DEFAULT   = "http://backend:8090";

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter
            .ofPattern("yyyy-MM-dd HH:mm:ss 'UTC'")
            .withZone(ZoneOffset.UTC);

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    private static final ObjectMapper JSON = new ObjectMapper();

    private static final List<ProviderConfigProperty> CONFIG_PROPERTIES = new ArrayList<>();

    static {
        // URL des Backends (konfigurierbar über die Admin Console)
        ProviderConfigProperty backendUrl = new ProviderConfigProperty();
        backendUrl.setName(BACKEND_URL_PROPERTY);
        backendUrl.setLabel("Backend URL");
        backendUrl.setType(ProviderConfigProperty.STRING_TYPE);
        backendUrl.setDefaultValue(BACKEND_URL_DEFAULT);
        backendUrl.setHelpText("Basis-URL des Resource Servers für den /api/internal/enrich/{username} Endpunkt.");
        CONFIG_PROPERTIES.add(backendUrl);

        // Name des Claims im Token (Standard: training_context)
        ProviderConfigProperty claimName = new ProviderConfigProperty();
        claimName.setName(OIDCAttributeMapperHelper.TOKEN_CLAIM_NAME);
        claimName.setLabel(OIDCAttributeMapperHelper.TOKEN_CLAIM_NAME_LABEL);
        claimName.setType(ProviderConfigProperty.STRING_TYPE);
        claimName.setDefaultValue("training_context");
        claimName.setHelpText(OIDCAttributeMapperHelper.TOKEN_CLAIM_NAME_TOOLTIP);
        CONFIG_PROPERTIES.add(claimName);

        // Checkboxen: in Access Token / ID Token / UserInfo einbinden
        OIDCAttributeMapperHelper.addIncludeInTokensConfig(CONFIG_PROPERTIES, TrainingInfoMapper.class);
    }

    @Override
    public String getId() {
        return PROVIDER_ID;
    }

    @Override
    public String getDisplayType() {
        return "Training Info Mapper";
    }

    @Override
    public String getDisplayCategory() {
        return TOKEN_MAPPER_CATEGORY;
    }

    @Override
    public String getHelpText() {
        return "Fügt einen 'training_context' Claim hinzu mit Login-Zeit, Session-ID und Auth-Methode - " +
               "zur Demonstration der Custom Protocol Mapper SPI.";
    }

    @Override
    public List<ProviderConfigProperty> getConfigProperties() {
        return CONFIG_PROPERTIES;
    }

    @Override
    protected void setClaim(IDToken token,
                            ProtocolMapperModel mappingModel,
                            UserSessionModel userSession,
                            KeycloakSession keycloakSession,
                            ClientSessionContext clientSessionCtx) {

        String username   = userSession.getUser().getUsername();
        String backendUrl = mappingModel.getConfig().getOrDefault(BACKEND_URL_PROPERTY, BACKEND_URL_DEFAULT);

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("mapper",          PROVIDER_ID);
        context.put("login_time",      FORMATTER.format(Instant.ofEpochSecond(userSession.getStarted())));
        context.put("session_id",      userSession.getId());
        context.put("auth_method",     userSession.getAuthMethod());
        context.put("user_enrichment", fetchEnrichment(username, backendUrl));
        context.put("note",            "Hinzugefügt durch Custom Protocol Mapper SPI");

        OIDCAttributeMapperHelper.mapClaim(token, mappingModel, context);
    }

    /**
     * Ruft GET {backendUrl}/api/internal/enrich/{username} auf.
     * Bei Fehler wird ein error-Objekt zurückgegeben, damit das Token trotzdem ausgestellt wird.
     */
    private Map<String, Object> fetchEnrichment(String username, String backendUrl) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(backendUrl + "/api/internal/enrich/" + username))
                    .timeout(Duration.ofSeconds(3))
                    .GET()
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                return JSON.readValue(response.body(), new TypeReference<>() {});
            }

            return Map.of("error", "HTTP " + response.statusCode());

        } catch (Exception e) {
            return Map.of("error", "Backend nicht erreichbar: " + e.getClass().getSimpleName());
        }
    }
}
