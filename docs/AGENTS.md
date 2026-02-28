# Documentation Maintenance Rules

## Keep Docs in Sync

If an implementation changes something documented in `/docs/`, you MUST update the corresponding doc in the same PR/commit.

### Examples

- Add a field to a database table -> update `docs/database-structure.md`
- Create a new API endpoint -> update `docs/api-routes.md`
- Add a new label type -> update `docs/pdf-generation.md`
- Change environment variables -> update `docs/environment-variables.md`
- Modify Supabase integration patterns -> update `docs/supabase-integration.md`
- Change project architecture or directory structure -> update `docs/architecture-overview.md`
- Modify hexagonal architecture patterns -> update `docs/hexagonal-architecture.md`

## Rules

- Maintain the existing format and structure of each document when updating.
- Only document changes that are already implemented and working. Do not document plans or WIP.
- Each doc file covers a single topic. Do not mix concerns across files.
- If a new topic emerges that doesn't fit any existing doc, create a new file and add a reference from the relevant AGENTS.md.
