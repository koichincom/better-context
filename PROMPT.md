# Build chat-web: Web-based btca Chat Interface

Create a new SvelteKit application called `chat-web` in `apps/chat-web/` that allows users to chat with a btca instance through a web interface.

## Project Overview

**What it does**: Web-based chat interface for btca (similar to `apps/cli/src/tui/`) that uses Daytona sandboxes for compute.

**Key Features**:

- Chat interface similar to the TUI in `apps/cli/src/tui/`
- Each chat session gets its own Daytona sandbox (created on-the-fly)
- Sessions are tracked and managed (create, reuse, cleanup)
- No authentication or user database needed (one-off like the CLI)
- Uses existing btca resources and functionality

**Stack**:

- SvelteKit + TypeScript + Tailwind CSS
- Bun runtime (no Node.js/npm/yarn)
- Daytona SDK for sandbox management
- Streaming responses from btca
- Session management (in-memory is fine for now)

## Reference Implementation

Look at `apps/cli/src/tui/` for the chat interface patterns:

- Message handling and display (`components/messages.tsx`, `components/markdown-text.tsx`)
- Input handling (`components/main-input.tsx`, `components/input-section.tsx`)
- Command palette patterns (`components/command-palette.tsx`)
- Resource management (`components/add-resource-wizard.tsx`)
- Context management (`context/messages-context.tsx`, `context/config-context.tsx`)
- Markdown rendering (`lib/markdown-renderer.ts`)
- Service integration (`services.ts`)

Adapt these patterns to work in a SvelteKit web environment (convert from React/Ink to Svelte).

## Daytona Integration

**Sandbox Lifecycle**:

1. User starts a new chat → Create new Daytona sandbox
2. Chat session → All btca queries run in that sandbox
3. User can resume previous sessions (track sandbox IDs)
4. Cleanup: Provide way to destroy old sandboxes

**Session Management**:

- Track active sessions (sandbox ID → session metadata)
- Store session history (messages, resource context)
- Allow switching between sessions
- Simple in-memory storage is fine (no database needed)

**Implementation Notes**:

- Use Daytona SDK to create/manage sandboxes
- Each sandbox should have btca installed and configured
- Pass user queries to btca running in the sandbox
- Stream responses back to the web UI

## Constraints

- **DO NOT** modify `apps/cli/` or `apps/server/`
- **DO NOT** add authentication or user database
- **DO NOT** add user management features
- Keep it simple: one-off tool like the CLI
- Everything else (`packages/shared/`, new packages, etc.) is fair game

## Environment Variables

Document any required env vars (Daytona API keys, etc.) in a `.env.example` file:

1. Document them with descriptions
2. Use placeholder values
3. **NEVER** ask for real API keys - assume they'll be configured later

## Development Setup

The app should:

1. Run with `bun dev` (development mode)
2. Build with `bun run build`
3. Start with `bun start` (production mode)
4. Follow the monorepo structure in `apps/chat-web/`

## Success Criteria

- [ ] SvelteKit app runs with `bun dev`
- [ ] Chat interface works (send messages, receive responses)
- [ ] Daytona sandboxes are created on-the-fly for new sessions
- [ ] Sessions are tracked and can be resumed
- [ ] btca queries execute in sandboxes and stream responses back
- [ ] Markdown rendering works for chat messages
- [ ] Resource management (mention codebases/docs like the TUI)
- [ ] Command palette or similar UX for actions
- [ ] Clean UI with Tailwind CSS
- [ ] Can list and switch between active sessions
- [ ] Can destroy old sandboxes

## Guidelines

- **Use btca liberally** - Ask svelte/sveltekit questions as needed!
- **Incremental progress** - Build one feature at a time
- **Reference the TUI** - Use `apps/cli/src/tui/` as a guide, but adapt to web/Svelte
- **Idiomatic SvelteKit** - Follow SvelteKit conventions and best practices
- **Keep it simple** - No auth, no database, just a functional chat interface
- **Document as you go** - Add README.md explaining how to use it
- **Working directory** - All new code goes in `apps/chat-web/`

---

## btca

use btca whenever you need to

## Loop Instructions

**IMPORTANT**: You are running in an automated loop via `opencode-loop.sh`.

**This means**:

- You can finish your work at ANY point - the loop will automatically continue
- As long as `STATUS.md` is NOT `completed` or `blocked`, another iteration will run
- You don't need to complete everything in one go - work incrementally!
- Focus on making meaningful progress each iteration, then finish naturally
- The next iteration will pick up where you left off

**On each iteration**:

1. Work towards completing the migration above (make incremental progress)
2. Leave notes/state wherever makes sense as you work
3. When COMPLETELY done with ALL work, update `STATUS.md` to `Status: completed`
4. If blocked, update `STATUS.md` to `Status: blocked` with a reason
5. Otherwise, just finish when you've made good progress - the loop continues automatically!
