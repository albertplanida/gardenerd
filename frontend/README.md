# Gardenerd Frontend

Next.js frontend for the Gardenerd local-network gardening app.

## Setup

Install dependencies:

```bash
npm install
```

Install Playwright browsers:

```bash
npx playwright install
```

## Development

Start the frontend development server:

```bash
npm run dev
```

The app runs at:

```text
http://localhost:3000
```

By default, frontend GraphQL requests are proxied through `/graphql`.

Configure local endpoints in `.env.local`:

```bash
cp .env.local.example .env.local
```

## Scripts

Run ESLint:

```bash
npm run lint
```

Check formatting:

```bash
npm run format:check
```

Format files:

```bash
npm run format
```

Run Jest unit/component tests:

```bash
npm test
```

Run Jest in watch mode:

```bash
npm run test:watch
```

Run Playwright end-to-end tests:

```bash
npm run e2e
```

Run Playwright in headed mode:

```bash
npm run e2e:headed
```

Open the Playwright UI:

```bash
npm run e2e:ui
```

## Testing Notes

Jest is used for unit and component tests with React Testing Library.

Playwright is used for browser end-to-end tests. The current Playwright setup
runs a basic home page smoke test against desktop Chrome and a mobile Chrome
profile.

Playwright starts the Next.js dev server automatically when running
`npm run e2e`.

Playwright uses `process.env.CI` to enable retries and avoid reusing an existing
dev server in CI. Local `.env` files do not need to define `CI`.
