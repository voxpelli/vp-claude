/**
 * @typedef McpMapping
 * @property {string} claudeName
 * @property {string} piName
 * @property {string} [description]
 */

/**
 * All mappings used across vp-knowledge skills and agents.
 * Sorted by server, then by tool name.
 *
 * @type {readonly McpMapping[]}
 */
export const MCP_MAPPINGS = [
  // Basic Memory
  { claudeName: 'mcp__basic-memory__build_context', piName: 'basic_memory_build_context', description: 'Load related notes around a given note' },
  { claudeName: 'mcp__basic-memory__edit_note', piName: 'basic_memory_edit_note', description: 'Modify an existing note' },
  { claudeName: 'mcp__basic-memory__list_directory', piName: 'basic_memory_list_directory', description: 'List notes in a directory' },
  { claudeName: 'mcp__basic-memory__move_note', piName: 'basic_memory_move_note', description: 'Move or rename a note' },
  { claudeName: 'mcp__basic-memory__read_note', piName: 'basic_memory_read_note', description: 'Read a note by identifier' },
  { claudeName: 'mcp__basic-memory__recent_activity', piName: 'basic_memory_recent_activity', description: 'Recent graph activity' },
  { claudeName: 'mcp__basic-memory__schema_diff', piName: 'basic_memory_schema_diff', description: 'Compare schema to note' },
  { claudeName: 'mcp__basic-memory__schema_infer', piName: 'basic_memory_schema_infer', description: 'Infer schema from notes' },
  { claudeName: 'mcp__basic-memory__schema_validate', piName: 'basic_memory_schema_validate', description: 'Validate a note against its schema' },
  { claudeName: 'mcp__basic-memory__search_notes', piName: 'basic_memory_search_notes', description: 'Search the knowledge graph' },
  { claudeName: 'mcp__basic-memory__write_note', piName: 'basic_memory_write_note', description: 'Create or overwrite a note' },

  // DeepWiki
  { claudeName: 'mcp__deepwiki__ask_question', piName: 'deepwiki_ask_question', description: 'Ask a question about a GitHub repo' },

  // Homebrew
  { claudeName: 'mcp__homebrew__info', piName: 'homebrew_info', description: 'Homebrew formula/cask info' },

  // Raindrop
  { claudeName: 'mcp__raindrop__create_bookmarks', piName: 'raindrop_create_bookmarks' },
  { claudeName: 'mcp__raindrop__create_collections', piName: 'raindrop_create_collections' },
  { claudeName: 'mcp__raindrop__delete_bookmarks', piName: 'raindrop_delete_bookmarks' },
  { claudeName: 'mcp__raindrop__fetch_bookmark_content', piName: 'raindrop_fetch_bookmark_content' },
  { claudeName: 'mcp__raindrop__find_bookmarks', piName: 'raindrop_find_bookmarks' },
  { claudeName: 'mcp__raindrop__find_collections', piName: 'raindrop_find_collections' },
  { claudeName: 'mcp__raindrop__find_tags', piName: 'raindrop_find_tags' },
  { claudeName: 'mcp__raindrop__update_bookmarks', piName: 'raindrop_update_bookmarks' },

  // Readwise
  { claudeName: 'mcp__readwise__reader_search_documents', piName: 'readwise_reader_search_documents' },
  { claudeName: 'mcp__readwise__readwise_search_highlights', piName: 'readwise_readwise_search_highlights' },

  // Socket
  { claudeName: 'mcp__socket-mcp__depscore', piName: 'socket_mcp_depscore' },

  // Tavily
  { claudeName: 'mcp__tavily__tavily_extract', piName: 'tavily_tavily_extract' },
  { claudeName: 'mcp__tavily__tavily_search', piName: 'tavily_tavily_search' },
]

/**
 * The set of skill names that trigger guidance injection.
 *
 * @type {Set<string>}
 */
export const VP_KNOWLEDGE_SKILL_NAMES = new Set([
  'knowledge-ask',
  'knowledge-gaps',
  'knowledge-garden',
  'knowledge-maintain',
  'knowledge-prime',
  'package-intel',
  'people-intel',
  'raindrop-triage',
  'schema-evolve',
  'session-bookmarks',
  'session-reflect',
  'tag-sync',
  'tool-intel',
  'vp-note-quality',
])
