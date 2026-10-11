# AI Knowledge Assistant — Frontend

React web app for the [AI Knowledge Assistant](https://github.com/mayankgz/ai-knowledge-assistant) backend: sign in, upload documents, watch them get indexed, and ask questions answered from your own files with streamed, source-cited responses.

## Features

- **Sign in / sign up** against the backend's JWT auth; an expired session returns you to sign-in with a notice
- **Drag-and-drop upload** (up to 10 MB per file, matching the backend limit)
- **Live indexing progress** — status badges (Queued → Indexing → Ready / Failed) and a batch-by-batch progress bar, refreshed every 2 s while anything is indexing; failed documents show the reason
- **Streaming answers** — the answer writes itself out as the LLM generates it, rendered as Markdown, with the source files shown as chips; a Stop button keeps the partial answer
- **Delete with confirmation** — removes the document, its stored file, and its search index entries
- Light and dark themes (follows the system setting) and a layout that stacks on narrow screens

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS 4 (with the typography plugin) · react-markdown · lucide-react icons

## Running locally

Prerequisites: Node.js 20+ and the [backend](https://github.com/mayankgz/ai-knowledge-assistant) running on `http://localhost:8080` (with its Docker services and Ollama).

```bash
npm install
npm run dev
```

Open http://localhost:5173.

The Vite dev server proxies every `/api` request to `localhost:8080` (see `vite.config.ts`), so the browser only talks to one origin and the backend needs no CORS configuration during development.

Other scripts:

```bash
npm run build     # type-check and build to dist/
npm run preview   # serve the production build
npm run lint      # oxlint
```

## How it talks to the backend

All API calls live in [`src/api.ts`](src/api.ts).

| Endpoint | Used for |
| --- | --- |
| `POST /api/v1/auth/register`, `/login` | Sign up / sign in; the JWT is kept in `localStorage` |
| `GET /api/v1/documents` | Document list with `status`, `batchesDone` / `batchesTotal`, `errorMessage` |
| `POST /api/v1/documents` | Multipart upload |
| `DELETE /api/v1/documents/{id}` | Delete |
| `POST /api/v1/query/stream` | Streamed answer (server-sent events) |

**Streaming.** The browser's `EventSource` can't send an `Authorization` header or make POST requests, so the stream is read with `fetch` and a small server-sent-events parser. The backend sends a `sources` event, then `token` events as the LLM writes, then `done` (or `error`); every event's data is JSON.

**Expired sessions.** Spring Security answers a missing, invalid, or expired token with a bare `403`, while the app's own "not your document" `403` has a JSON body with `"error": "FORBIDDEN"`. The client uses that difference to tell "sign in again" apart from "not allowed".

## Project structure

```text
src/
├── api.ts                    # typed API client + SSE stream parser
├── format.ts                 # file size, relative time, initials helpers
├── App.tsx                   # auth state (localStorage) → AuthScreen or Workspace
├── index.css                 # Tailwind setup and the indeterminate progress animation
└── components/
    ├── AuthScreen.tsx        # sign in / sign up
    ├── Workspace.tsx         # header + two-panel layout, shared error handling
    ├── DocumentsPanel.tsx    # upload, document list, progress, delete
    └── ChatPanel.tsx         # streamed chat, sources, stop
```

## Limitations

- Chat history lives in memory and is lost on reload (the backend doesn't store conversations yet).
- The JWT is stored in `localStorage`, which is simple but readable by any script on the page; an HttpOnly cookie would be safer for production.
- There is no production deployment setup yet; in production the app would need either the same origin as the API or CORS on the backend.
