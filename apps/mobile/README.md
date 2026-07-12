# Mobile (Expo scaffold)

Read-only trust overview for phones, sharing `@iatg/shared` with the web
app. Per plan D3 this ships **after** the July 31 submission (finals add
the Implementation criterion in October); the scaffold exists now so the
API client and types stay shared from day one.

```bash
pnpm --filter @iatg/shared build   # metro resolves the built package
pnpm --filter @iatg/mobile start   # expo dev server (Expo Go on device)
```

Next milestones: gateway API client (Connect-RPC generated TS), live
safety feed over WebSocket, zh-TW locale.
