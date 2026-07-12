# ERH Engine

Vendored deployment copy of the Ethic-Latex ERH engine used by the Inclusive
AI Trust Gateway.

Back4App settings:

- Root directory: `services/erh-engine`
- Port: `8000`
- Env vars:
  - `ERH_MODE=rest`

After deployment, set the gateway app env:

```env
ERH_SERVICE_URL=https://<erh-engine-app>.b4a.run
```

The source was copied from the sibling `Ethic-Latex` repository so this repo can
build the ERH container without relying on an external Back4App GitHub app.
