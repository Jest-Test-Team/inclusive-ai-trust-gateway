# Trust gateway (Go) - build context is the repo root.
# Works on Choreo (console.choreo.dev) and any Dockerfile-based container host.
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY services/gateway/go.mod services/gateway/go.sum ./
RUN go mod download
COPY services/gateway/ .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/gateway ./cmd/gateway

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/gateway /gateway
EXPOSE 8080
# Choreo requires a numeric non-root UID in the 10000-20000 range.
USER 10014
ENTRYPOINT ["/gateway"]
