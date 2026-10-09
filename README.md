# CarrerNaviq

Career workspace for employers, recruiters, jobs, study materials, interview support, user/admin messages, and AI Auto Apply. [Live application](https://employer-directory.groovy-ghost-2604.chatgpt.site/).

## Project structure

- `dist/`: editable HTML, CSS, and browser JavaScript. Despite its name, this folder contains the frontend source. `companies.json` provides the initial employer directory.
- `worker/index.js`: authenticated API routes and application services.
- `worker/job-feeds.js`: job-source connectors and category matching.
- `worker/chat.js`: message attachment parsing and private R2 storage helpers.
- `worker/vault.js`: AES-GCM credential encryption and Vault table initialization.
- `db/schema.ts` and `drizzle/`: D1 schema definitions and SQL migrations.
- `auto-apply-worker/`: separate automation worker configuration and deployment instructions. Browser automation requires that external service; saving credentials does not connect or authenticate job accounts.
- `scripts/build.mjs`: embeds frontend assets and backend helpers into the generated `dist/server/index.js` Worker entrypoint.
- `tests/`: job feeds/import, attachment, and Vault verification.

## Development

```sh
npm ci
npm test
npm run format:check
```

Use `npm run format` to apply consistent source formatting. Run `npm run build` before packaging a deployment. Generated Worker bundles and local deployment archives are excluded from Git.

## Hosting and data

OpenAI Sites deploys the existing Worker, with Cloudflare D1 bound as `DB` and R2 bound as `BUCKET`. `.openai/hosting.json` identifies the existing Sites project. GitHub pushes do not publish the site or copy production database records, uploaded documents, or credentials.

Employer edits, access requests, profiles, messages, attachments metadata, job records, and Auto Apply state persist in D1. File bytes persist in R2. The Vault stores encrypted credentials in D1, scoped to the account email and provider. Runtime secrets are configured in Sites, never in source or frontend assets.

For a fresh installation, apply the SQL files in `drizzle/` in order and configure the D1/R2 bindings. Existing installations also initialize newer messaging and Vault tables idempotently at runtime.

## Runtime configuration

- `CREDENTIAL_VAULT_KEY`: secret, base64-encoded 32-byte AES key. Preserve it across deployments; changing it without re-encryption makes saved Vault entries unreadable.
- `SKYVERN_WORKER_URL` and `AUTO_APPLY_WORKER_SECRET`: external automation service configuration. See `auto-apply-worker/README.md` for additional requirements.

Passwords are never returned by the Vault API. Attachments require the conversation owner or an authorized admin. Upload limits are five files, 10 MB per file, and 25 MB per message.

## Job refreshes

Latest Posted Jobs displays saved listings. Double-clicking a technology tab requests a refresh; jobs are ordered by posting date, with 25 listings per page. Source failures preserve previously saved jobs. A database cooldown prevents overlapping refreshes. An unattended refresh requires a separately configured schedule; opening the page is not an unattended scheduler.

## Authentication limitation

The current access workflow identifies accounts by an entered email address and does not verify ownership of that address. Replace this with verified authentication before relying on it to protect sensitive production data. Encryption does not fix identity verification. Keep the repository private and never commit secrets, database exports, or user uploads.
