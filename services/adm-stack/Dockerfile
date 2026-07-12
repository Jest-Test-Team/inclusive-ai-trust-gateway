FROM golang:1.25-alpine AS build

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /src
COPY source/go.mod source/go.sum ./
RUN go mod download

COPY source/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/adm-gateway ./cmd/gateway
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/adm-siem ./cmd/siem_engine

FROM alpine:3.20

RUN apk add --no-cache ca-certificates
COPY --from=build /out/adm-gateway /usr/local/bin/adm-gateway
COPY --from=build /out/adm-siem /usr/local/bin/adm-siem
COPY entrypoint.sh /entrypoint.sh

ENV ADM_PORT=8080
ENV ADM_GRPC_PORT=9090
ENV ADM_SIEM_URL=http://127.0.0.1:9091
ENV ADM_SIEM_PORT=9091

EXPOSE 8080 9090 9091

ENTRYPOINT ["/entrypoint.sh"]
