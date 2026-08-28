/**
 * Mock ExtensionAPI and ExtensionContext builders for testing
 * vp-knowledge-pi without a real Pi runtime.
 *
 * Pattern inspired by rpiv-pi's test utilities, adapted for node:test.
 */

/** @typedef {import('@earendil-works/pi-coding-agent').ExtensionAPI} ExtensionAPI */
/** @typedef {import('@earendil-works/pi-coding-agent').ExtensionContext} ExtensionContext */

/**
 * `events.on` returns the caller's unsubscribe function. Hoisted rather than
 * inlined so it is one shared no-op, and so the mock's shape says plainly that
 * an unsubscriber exists — the mock used to return void, so any code storing
 * and later calling it would have thrown against the mock while working
 * against the real API.
 */
const noopUnsubscribe = () => {}

/**
 * The recorded calls, one named array per ExtensionAPI method.
 *
 * A named shape rather than `Record<string, unknown[]>`: under
 * `noUncheckedIndexedAccess` every `calls.on.push(...)` on a Record is
 * "possibly undefined", which is the noise that made `@ts-nocheck` look
 * reasonable here. Naming the keys removes the noise and leaves the two real
 * fidelity gaps this file was hiding.
 *
 * @typedef MockCalls
 * @property {unknown[]} on
 * @property {unknown[]} registerCommand
 * @property {unknown[]} registerTool
 * @property {unknown[]} sendMessage
 * @property {unknown[]} sendUserMessage
 * @property {unknown[]} appendEntry
 * @property {unknown[]} setActiveTools
 * @property {unknown[]} setModel
 * @property {unknown[]} getFlag
 */

/**
 * Build a mock ExtensionAPI suitable for testing extension factories.
 *
 * @returns {{
 *   pi: ExtensionAPI,
 *   calls: MockCalls,
 *   handlers: Map<string, Function[]>,
 *   commands: Map<string, { handler: Function }>
 * }}
 */
export function createMockPi () {
  /** @type {Map<string, Function[]>} */
  const handlers = new Map()

  /** @type {MockCalls} */
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

  // `Partial<ExtensionAPI>`, then one narrow cast at the return below. The mock
  // implements the nine methods this extension actually calls, not all 24 --
  // deliberate, but previously expressed as a whole-file `@ts-nocheck`, which
  // switched off checking of the nine it DOES implement. `Partial` keeps every
  // member checked against its real signature while dropping only the
  // must-implement-all requirement. That distinction is what surfaced the
  // getFlag return type, the missing events.on unsubscriber, and an `off`
  // method the real EventBus does not have.
  /** @type {Partial<ExtensionAPI>} */
  const partialPi = {
    on: (event, handler) => {
      calls.on.push({ event, handler })
      const forEvent = handlers.get(event) ?? []
      forEvent.push(handler)
      handlers.set(event, forEvent)
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
      // Explicit: the real signature is `string | boolean | undefined`, and an
      // arrow with a bare statement body returns void, which is NOT assignable
      // to it. `@ts-nocheck` hid that the mock had a different contract from
      // the thing it stands in for. The `undefined` is load-bearing, not
      // useless -- it is what makes the return type match.
      // eslint-disable-next-line unicorn/no-useless-undefined
      return undefined
    },
    events: {
      // `on` returns its own unsubscribe function. The mock returned void, so
      // any code that stored and later called the unsubscriber would have
      // thrown against the mock while working against the real API.
      on: () => noopUnsubscribe,
      emit: () => {},
      // No `off`: the real EventBus has none -- unsubscribing goes through the
      // function `on` returns. The mock had invented one, which `@ts-nocheck`
      // let stand, and nothing in this repo ever called it.
    },
  }

  // The one place fidelity is asserted rather than checked. A test that reaches
  // for an unmocked method gets `undefined is not a function` at run time,
  // which is a louder and more locatable failure than a silently-typed stub.
  const pi = /** @type {ExtensionAPI} */ (/** @type {unknown} */ (partialPi))

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
