# CarrerNaviq AI Auto Apply worker

CarrerNaviq Sites can host the UI, database, API, and resume storage, but it cannot run Docker, Chromium browser sessions, Skyvern, or Ollama inside the Sites runtime. Deploy this worker on a VM or container host that can run Docker and browsers.

Required services:

- Skyvern self-hosted browser automation.
- Ollama with a real tool-capable local model selected after testing, for example `llama3.1:8b` for lightweight tests or a stronger local model when hardware allows.
- This small adapter API with `AUTO_APPLY_WORKER_SECRET` shared with the Sites environment.

CarrerNaviq environment values:

- `SKYVERN_WORKER_URL=https://your-worker.example.com`
- `AUTO_APPLY_WORKER_SECRET=<long random secret>`
- `OLLAMA_MODEL=<tested local model name>`

Security requirements:

- Use one isolated browser context per CarrerNaviq user.
- Never store plaintext passwords.
- Do not bypass CAPTCHA, MFA, or platform restrictions.
- Pause and return a blocker when verification, unknown questions, missing profile data, upload failures, or final submission confirmation is required.
- Return actual task events only. Do not report successful submission until the employer site displays a confirmation or sends a verified result.

The current Sites backend calls `POST /tasks/start` with the user profile, selected application, resume metadata, instructions, and `requireFinalApproval: true`. The worker should respond with `{ "taskId": "..." }`, then later call back through secure CarrerNaviq APIs once callback endpoints are added for production deployment.
