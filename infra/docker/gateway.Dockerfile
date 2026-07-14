# Trust gateway (Go) — build context is the repo root
# docker build -f infra/docker/gateway.Dockerfile .
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY services/gateway/go.mod services/gateway/go.sum ./
RUN go mod download
COPY services/gateway/ .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/gateway ./cmd/gateway

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/gateway /gateway
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/gateway"]
