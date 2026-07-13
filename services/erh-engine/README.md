# ERH Engine

Vendored deployment copy of the Ethic-Latex ERH engine used by the Inclusive
AI Trust Gateway.

Choreo settings (see `infra/choreo/README.md`):

- Component directory / Docker context: `services/erh-engine` (**not** repo root)
- Dockerfile: `Dockerfile`
- Endpoint port: **8080** (matches `PORT` / `.choreo/component.yaml`)
- Env vars (optional; defaults are baked in):
  - `ERH_MODE=rest`
  - `PORT=8080`

After deployment, set:

```env
# Vercel
ERH_API_BASE_URL=https://<erh-engine-choreo-invoke-url>

# Choreo trust-gateway
ERH_SERVICE_URL=https://<erh-engine-choreo-invoke-url>
```

Health check:

```bash
curl -s "https://<erh-engine-choreo-invoke-url>/v1/health"
```

If Choreo returns `102504 Upstream connection timeout`, the container is not
listening on the endpoint port — rebuild with this Dockerfile (port 8080) and
confirm the component endpoint port is also 8080.
