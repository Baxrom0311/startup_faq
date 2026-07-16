# AI Runbook

## Flow

```text
problem submitted
-> arq analyze_problem
-> optional STT
-> LLM structure
-> embedding
-> duplicate check
-> severity score
-> published | needs_review | archived duplicate
```

## Providers

Set `LLM_PROVIDER` to one of:

- `anthropic`
- `openai`
- `gemini`
- `deepseek`
- `ollama`

Every remote provider falls back to deterministic analysis if the API key is empty. If a configured provider fails during a worker run, the analyzer logs the error and falls back to deterministic analysis.

## STT

Set `STT_PROVIDER` to:

- `whisper_local`: downloads the audio object from MinIO/S3 and runs `faster-whisper` when installed.
- `api`: posts multipart audio to `STT_API_URL` and expects `text` or `transcript` in the JSON response.

If STT is unavailable, the analyzer continues without transcript and sends audio-only problems to review.

## Worker

Run the worker:

```bash
cd backend
uv run arq app.worker.main.WorkerSettings
```

The API enqueues analysis after problem submission. The worker must be running for `ai_processing` problems to become `published` or `needs_review`.

## Moderation

Problems with risky flags or low actionability go to `needs_review`.

Admins can use:

- `GET /api/v1/problems/?status=needs_review`
- `GET /api/v1/problems/{id}/analyses`
- `POST /api/v1/problems/{id}/publish`
- `POST /api/v1/problems/{id}/archive`
- `POST /api/v1/problems/{id}/merge`
- `POST /api/v1/problems/{id}/reanalyze`

The frontend exposes this under `Admin -> Review` and on the problem detail page.

Use `reanalyze` after changing `LLM_PROVIDER`, model names, prompt version, or STT settings. Archived and solved problems are intentionally not reanalyzed.

## Embeddings

Set `EMBEDDING_PROVIDER` to one of:

- `hash`: deterministic fallback, no external dependencies.
- `openai`: uses `OPENAI_API_KEY` and `EMBEDDING_MODEL`.
- `gemini`: uses `GEMINI_API_KEY` and `EMBEDDING_MODEL`.
- `ollama`: uses `OLLAMA_BASE_URL` and `EMBEDDING_MODEL`.
- `api`: posts `{model,input}` to `EMBEDDING_API_URL`.

The hash provider is useful for local development, but production dedup should use a semantic multilingual embedding model. If a remote embedding provider has no key/url, it falls back to hash embedding.
