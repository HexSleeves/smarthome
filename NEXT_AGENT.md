## Smart Home Backend - Add Core Tests

### Context
This is a **Fastify + tRPC + TypeScript** smart home API that integrates with Ring (doorbells/cameras) and Roborock (vacuums). The codebase has been cleaned up and all routes use tRPC except for one REST endpoint (Ring snapshot for `<img src>`).

### Task: Add Tests for Core Functionality

Add focused tests for critical paths only. Don't over-test - focus on:

1. **Auth flow** (most critical)
   - Register creates user, returns tokens
   - Login with valid/invalid credentials
   - Refresh token works
   - Protected routes reject without token

2. **Crypto utilities**
   - Encrypt/decrypt round-trip works
   - Decryption fails with wrong key

3. **Database queries**
   - User creation and lookup
   - Credentials save/retrieve

### Setup Requirements

```bash
# Install Vitest
npm install -D vitest @vitest/coverage-v8 -w @smarthome/backend

# Add to packages/backend/package.json scripts:
"test": "vitest run",
"test:watch": "vitest"
```

### Test Structure
```
packages/backend/src/
  __tests__/
    auth.test.ts      # tRPC auth router tests
    crypto.test.ts    # encrypt/decrypt tests
    queries.test.ts   # DB query tests
  test-utils.ts       # Shared setup (in-memory DB, test app)
```

### Key Considerations

- Use **in-memory SQLite** for tests (`:memory:`)
- Create a test Fastify app with tRPC registered
- Mock external services (Ring, Roborock) - don't test their integration
- Keep tests fast and focused

### Files to Reference
- `packages/backend/src/trpc/routers/auth.ts` - Auth endpoints to test
- `packages/backend/src/lib/crypto.ts` - Crypto functions
- `packages/backend/src/db/queries.ts` - DB queries
- `packages/backend/src/db/schema.ts` - DB schema

### Commands
```bash
npm run build -w @smarthome/backend  # Must pass before tests
npm run test -w @smarthome/backend   # Run tests
```

### Constraints
- No `any` types
- Tests should run in <10 seconds
- Don't mock what you can test directly (crypto, DB queries)
- Do mock external APIs (Ring, Roborock)
