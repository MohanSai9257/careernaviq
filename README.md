# CareerNaviq

CareerNaviq is a career directory and job search site with employer, recruiter, study material, interview preparation, interview support, and latest-jobs sections. The live site is [CareerNaviq](https://employer-directory.groovy-ghost-2604.chatgpt.site/).

## Architecture

- **Frontend:** HTML, CSS, and browser JavaScript in `dist/`. The initial employer directory is `dist/companies.json`.
- **Backend:** A Cloudflare Worker in `worker/index.js`, with job-source connectors in `worker/job-feeds.js`. `scripts/build.mjs` packages the frontend assets with the Worker as `dist/server/index.js`.
- **Hosting:** OpenAI Sites, which deploys the Worker and static assets. `.openai/hosting.json` contains the Sites project ID and logical resource bindings.
- **Database:** A Sites-managed Cloudflare D1 SQLite database, bound to the Worker as `DB`. `db/schema.ts` and `drizzle/` define and migrate its tables. The actual production database and its records are **not** stored in this repository.
- **File storage:** A Sites-managed Cloudflare R2 bucket, bound as `BUCKET`, for uploaded PDF/Word materials. The actual uploaded files are **not** stored in this repository.
- **Job sources:** Employer careers pages and public recruiting-board feeds (including Amazon careers, SmartRecruiters, Greenhouse, Lever, Ashby, and some careers RSS feeds). The user starts a source check with **Generate**; imported listings are stored in D1 and filtered by category, employer page, posted date, and experience.

## Data stored in D1

The schema includes employer edits and additions; access requests, user status and sessions; co-admins; review requests; recruiter/material/interview entries; user profiles; tab access settings; imported jobs; and job-source check results. Uploaded document metadata is in D1 while the file bytes are in R2. The 23,000-plus initial employer rows are a versioned JSON asset, while subsequent changes are in D1.

## Development

```sh
npm ci
npm run build
node tests/job-feeds.mjs
node tests/job-import.mjs
```

Deployment uses the existing Sites project specified in `.openai/hosting.json`. A fresh deployment needs its own Sites project, D1 and R2 bindings, and all `drizzle/` migrations applied. Pushing to GitHub alone does **not** deploy the site or copy its production data.

## Security note

The current application identifies users and its administrator by an email address entered in the UI; it does **not** verify ownership of that address. The admin email is present in the source code. This is not strong authentication and should be replaced with verified login before storing sensitive user data or treating admin access as secure. The GitHub repository should be kept private until this is fixed. Do not commit passwords, tokens, production database exports, or uploaded user documents.
