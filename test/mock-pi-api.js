/**
 * Mock ExtensionAPI and ExtensionContext builders for testing
 * vp-knowledge-pi without a real Pi runtime.
 *
 * Pattern inspired by rpiv-pi's test utilities, adapted for node:test.
 */

// @ts-nocheck — Test mocks intentionally skip full ExtensionContext type fidelity

/** @typedef {import('@earendil-works/pi-coding-agent').ExtensionAPI} ExtensionAPI */
/** @typedef {import('@earendil-works/pi-coding-agent').ExtensionContext} ExtensionContext */

/**
 * Build a mock ExtensionAPI suitable for testing extension factories.
 *
 * @returns {{
 *   pi: ExtensionAPI,
 *   calls: Record<string, unknown[]>,
 *   handlers: Map<string, Function[]>,
 *   commands: Map<string, { handler: Function }>
 * }}
 */
export function createMockPi () {
  /** @type {Map<string, Function[]>} */
  const handlers = new Map()

  /** @type {Record<string, unknown[]>} */
  const calls = {
    on: [],
    registerCommand: [],
    registerTool: [],
    sendMessage: [],
    sendUserMessage: [],
    appendEntry: [],
    setActiveTools: [],
    setModel: [],
    getFlag: [],
  }

  /** @type {Map<string, { handler: Function }>} */
  const commands = new Map()

  /** @type {ExtensionAPI} */
  const pi = {
    on: (event, handler) => {
      calls.on.push({ event, handler })
      if (!handlers.has(event)) handlers.set(event, [])
      handlers.get(event).push(handler)
    },
    registerCommand: (name, options) => {
      calls.registerCommand.push({ name, options })
      commands.set(name, options)
    },
    registerTool: (definition) => {
      calls.registerTool.push({ definition })
    },
    sendMessage: (message, options) => {
      calls.sendMessage.push({ message, options })
    },
    sendUserMessage: (text, options) => {
      calls.sendUserMessage.push({ text, options })
    },
    appendEntry: (customType, data) => {
      calls.appendEntry.push({ customType, data })
    },
    setActiveTools: (toolNames) => {
      calls.setActiveTools.push({ toolNames })
    },
    setModel: async (model) => {
      calls.setModel.push({ model })
      return true
    },
    getFlag: (name) => {
      calls.getFlag.push({ name })
    },
    events: {
      on: () => {},
      emit: () => {},
      off: () => {},
    },
  }

  return { pi, calls, handlers, commands }
}

/**
 * Build a mock ExtensionContext.
 *
 * @param {Record<string, unknown>} [overrides]
 * @returns {{ ctx: any, uiCalls: Array<{method: string, args: unknown[]}> }}
 */
export function createMockContext (overrides = {}) {
  /** @type {Array<{method: string, args: unknown[]}>} */
  const uiCalls = []

  /** @type {any} */
  const ctx = {
    mode: overrides.mode ?? 'tui',
    hasUI: overrides.hasUI ?? true,
    cwd: overrides.cwd ?? '/tmp/test',
    isProjectTrusted: () => overrides.isProjectTrusted ?? true,
    isIdle: () => overrides.isIdle ?? true,
    hasPendingMessages: () => overrides.hasPendingMessages ?? false,
    abort: () => {},
    shutdown: () => {},
    getContextUsage: () => {},
    compact: () => {},
    getSystemPrompt: () => overrides.systemPrompt ?? '',
    signal: overrides.signal ?? undefined,
    sessionManager: overrides.sessionManager ?? {
      getEntries: () => [],
      getBranch: () => [],
      getSessionFile: () => {},
      getSessionId: () => 'test-session',
      buildContextEntries: () => [],
      getLeafId: () => 'leaf-1',
    },
    modelRegistry: overrides.modelRegistry ?? {},
    model: overrides.model ?? undefined,
    ui: {
      notify: (/** @type {any} */ message, /** @type {any} */ type) => {
        uiCalls.push({ method: 'notify', args: [message, type] })
      },
      select: async (/** @type {any} */ title, /** @type {any} */ options, /** @type {any} */ opts) => {
        uiCalls.push({ method: 'select', args: [title, options, opts] })
        return /** @type {any} */ (overrides.selectResult) ?? undefined
      },
      confirm: async (/** @type {any} */ title, /** @type {any} */ message, /** @type {any} */ opts) => {
        uiCalls.push({ method: 'confirm', args: [title, message, opts] })
        return /** @type {any} */ (overrides.confirmResult) ?? false
      },
      input: async (/** @type {any} */ title, /** @type {any} */ placeholder, /** @type {any} */ opts) => {
        uiCalls.push({ method: 'input', args: [title, placeholder, opts] })
        return /** @type {any} */ (overrides.inputResult) ?? undefined
      },
      editor: async (/** @type {any} */ title, /** @type {any} */ prefill) => {
        uiCalls.push({ method: 'editor', args: [title, prefill] })
        return /** @type {any} */ (overrides.editorResult) ?? undefined
      },
      setStatus: (/** @type {any} */ key, /** @type {any} */ text) => {
        uiCalls.push({ method: 'setStatus', args: [key, text] })
      },
      setWidget: (/** @type {any} */ key, /** @type {any} */ content, /** @type {any} */ options) => {
        uiCalls.push({ method: 'setWidget', args: [key, content, options] })
      },
      custom: async (/** @type {any} */ factory, /** @type {any} */ options) => {
        uiCalls.push({ method: 'custom', args: [factory, options] })
        /** @type {any} */
      },
    },
  }

  return { ctx: /** @type {ExtensionContext} */ (ctx), uiCalls }
}
