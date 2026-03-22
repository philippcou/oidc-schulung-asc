# Stage 1: Custom Protocol Mapper bauen
FROM maven:3.9-eclipse-temurin-21 AS mapper-builder
WORKDIR /build
COPY mapper/ .
RUN mvn package -q --no-transfer-progress -DskipTests

# Stage 2: Keycloak konfigurieren & bauen
FROM quay.io/keycloak/keycloak:latest AS builder

ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

WORKDIR /opt/keycloak

# Realm-Konfiguration für den Import
#COPY realm-export-finished.json /opt/keycloak/data/import/realm-export-finished.json
#COPY realm-export.json /opt/keycloak/data/import/realm-export.json

# Custom Protocol Mapper JAR einbinden
COPY --from=mapper-builder /build/target/training-protocol-mapper-1.0.0.jar /opt/keycloak/providers/

# for demonstration purposes only, please make sure to use proper certificates in production instead
RUN keytool -genkeypair -storepass password -storetype PKCS12 -keyalg RSA -keysize 2048 -dname "CN=server" -alias server -ext "SAN:c=DNS:localhost,IP:127.0.0.1" -keystore conf/server.keystore

# Keycloak neu bauen damit der Provider registriert wird
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:latest
COPY --from=builder /opt/keycloak/ /opt/keycloak/

ENV KC_HOSTNAME=localhost
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
