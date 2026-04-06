## Feature Requests

_No entries yet._

## Bugs

- **`update_bookmarks` silently fails when combining `add_tags` and `remove_tags`** (2026-04-07) \[degraded\] — Passing both `add_tags` and `remove_tags` in a single operation returns "Unknown error" with no details. Must split into two separate operations (remove first, then add), doubling API calls for any tag edit that involves both adding and removing.
  Severity: degraded · Ownership: upstream · Workaround: full — split into separate remove and add operations

- **`find_tags` exact lookup returns semantic search results** (2026-04-07) \[minor\] — Calling `find_tags(tags=["ai-bookmarked"])` returns unrelated tags ranked by semantic similarity (e.g., `philosophy`, `manifesto`) instead of the exact tag. The `search` parameter works correctly for finding specific tags by name.
  Severity: minor · Ownership: upstream · Workaround: full — use `search` parameter instead of `tags` array for exact lookups

## Upstream Opportunities

_No entries yet._
