FROM golang:1.25-alpine AS build

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /src
COPY source/go.mod source/go.sum ./
RUN go mod download

COPY source/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/adm-gateway ./cmd/gateway
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/adm-siem ./cmd/siem_engine

FROM alpine:3.20

# redis is embedded so the whole ADM stack ships as one container app —
# no separate Redis host needed on free tiers.
RUN apk add --no-cache ca-certificates redis && \
    adduser -D -u 10014 iatg
COPY --from=build /out/adm-gateway /usr/local/bin/adm-gateway
COPY --from=build /out/adm-siem /usr/local/bin/adm-siem
COPY entrypoint.sh /entrypoint.sh

ENV ADM_PORT=8080
ENV ADM_GRPC_PORT=9090
ENV ADM_SIEM_URL=http://127.0.0.1:9091
ENV ADM_SIEM_PORT=9091
# Set ADM_EMBED_REDIS=0 and point ADM_REDIS_URL at a managed instance
# (e.g. Upstash) to use an external Redis instead.
ENV ADM_EMBED_REDIS=1
ENV ADM_REDIS_URL=redis://127.0.0.1:6379/0

EXPOSE 8080 9090 9091

# Choreo requires a numeric non-root UID in the 10000-20000 range.
USER 10014
WORKDIR /tmp

ENTRYPOINT ["/entrypoint.sh"]
