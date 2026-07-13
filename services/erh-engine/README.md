# ERH Engine

Vendored deployment copy of the Ethic-Latex ERH engine used by the Inclusive
AI Trust Gateway.

Choreo settings (see `infra/choreo/README.md`):

- Component directory: `services/erh-engine`
- Build preset: Docker
- Port: `8000` (from `.choreo/component.yaml`)
- Env vars:
  - `ERH_MODE=rest`

After deployment, set the gateway component env:

```env
ERH_SERVICE_URL=https://<erh-engine-choreo-public-url>
```

The source was copied from the sibling `Ethic-Latex` repository so this repo can
build the ERH container without relying on an external deployment hook.
