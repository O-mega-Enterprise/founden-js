# founden (TypeScript SDK)

Build and run your company from your own code with one API key. [Founden](https://founden.ai) builds the full product (website, app, admin) in the cloud and returns a live link.

## Install

```bash
npm install founden
```

## Usage

```ts
import { Founden } from "founden";

const client = new Founden("omk_your_key_here");

// Start a build
const build = await client.build("Build a booking site for my dental clinic with online payments");
const id = build.data!.execution_id as string;

// Stream live progress (events: build_step, build_complete, build_done, orphaned_build, build_error)
for await (const ev of client.stream(id)) {
  console.log(ev.event, ev.data);
}

// Check status / preview URL
const status = await client.status(id);
console.log(status.data?.preview_url);

// Send a follow-up instruction
await client.message(id, "Add a contact form on the homepage");

// Stop a running build
await client.stop(id);
```

## Methods

| Method | Endpoint | Description |
|--------|----------|-------------|
| `build(prompt, opts?)` | `POST /v1/builds` | Start a build (`opts.company_id` to target an existing company). Metered: charged for the compute the build uses. |
| `status(executionId, opts?)` | `GET /v1/builds/{id}` | Status + live preview URL. |
| `message(executionId, prompt, opts?)` | `POST /v1/builds/{id}/message` | Follow-up instruction. Metered, like the build. |
| `stop(executionId, opts?)` | `POST /v1/builds/{id}/stop` | Stop a running build. |
| `stream(executionId)` | `GET /v1/builds/{id}/stream` | Async generator of SSE build events. |

Every call returns a `FoundenResult` (`success`, `data`, `error`, `metadata`, `credits_used`). One `omk_` key works across every O-mega product. Get yours at https://founden.ai/app/build.

## License

MIT
