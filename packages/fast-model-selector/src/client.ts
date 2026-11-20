/**
 * Browser entry for the fast model selector. It shadows the native composer
 * model seat at a lower slot priority and renders the two-column panel from
 * the shared per-session ModelDirectory, so switches made here, through the
 * /model command, or by a settings/catalog refresh all stay in sync.
 */
import { createSeat, type ModelDirectoryState, type ReactDOMLike, type ReactLike, type RemoteResult, type SeatInjected, type Selection, type SnapshotStore } from './seat'
import { en, NS, zh } from './locales'
import { CSS } from './theme'

const PLUGIN_ID = 'dsh-plugin-fast-model-selector'
const STYLE_ID = `${PLUGIN_ID}/theme.css`
/** Native seat registers at the default priority 0; a lower priority shadows it. */
const SEAT_PRIORITY = -2

interface ClientModuleFace {
  inject?: string[]
  apply(ctx: ClientContext): void
}

interface ClientModule {
  id: string
  factory(require: (id: string) => unknown): ClientModuleFace
}

interface ModuleLoader {
  load(module: ClientModule): void
}

interface SlotsService {
  inject(name: string, effect: () => unknown): void
  register(options: SlotRegistration, component: unknown): () => void
}

interface SlotRegistration {
  name: string
  priority?: number
  locale?: string
  inject?: (sessionId: string) => SeatInjected
}

interface ClientLocale {
  register(ns: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): () => void
  resolveText(text: unknown): string
}

interface SessionsFace {
  subagentAddress(sessionId: string): unknown
}

interface ModelDirectoryFace {
  store: SnapshotStore<ModelDirectoryState>
  load(): Promise<ModelDirectoryState>
  select(selection: Selection): Promise<RemoteResult<void>>
}

interface ModelDirectoriesFace {
  directoryFor(sessionId: string): ModelDirectoryFace
}

interface TeamRemoteFace {
  setEnabled(sessionId: string, enabled: boolean): Promise<RemoteResult<void>>
}

interface RemoteFace {
  agentTeams?: TeamRemoteFace
}

interface ClientContext {
  effect(effect: () => void | (() => void), label?: string): void
  inject(deps: readonly string[], callback: (scope: ClientContext) => void): void
  get(name: string): unknown
  slots: SlotsService
  locale: ClientLocale
  sessions: SessionsFace
  modelDirectories: ModelDirectoriesFace
  remote: RemoteFace
}

const moduleLoader = (globalThis as unknown as { __ModuleLoader__?: ModuleLoader }).__ModuleLoader__

moduleLoader?.load({
  id: 'dsh-plugin-fast-model-selector',
  factory(require) {
    const React = require('react') as ReactLike
    const ReactDOM = require('react-dom') as ReactDOMLike
    const FastModelSelector = createSeat(React, ReactDOM)

    function apply(ctx: ClientContext): void {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'fast-model-selector: dictionaries')

      ctx.effect(() => {
        if (typeof document === 'undefined') return undefined
        const style = document.createElement('style')
        style.dataset.plugin = PLUGIN_ID
        style.dataset.pluginCss = STYLE_ID
        style.textContent = CSS
        document.head.append(style)
        return () => { style.remove() }
      }, 'fast-model-selector: theme')

      ctx.inject(['slots', 'sessions', 'modelDirectories', 'remote'], (scope) => {
        const sessions = scope.sessions
        const models = scope.modelDirectories
        let teamRemote: TeamRemoteFace | undefined
        try {
          teamRemote = scope.get('remote.agentTeams') as TeamRemoteFace | undefined
        } catch {
          teamRemote = undefined
        }
        scope.inject(['remote.agentTeams'], (teamScope) => {
          teamRemote = teamScope.remote.agentTeams
        })

        scope.slots.inject('conversation.input.model', () => scope.slots.register({
          name: 'conversation.input.model',
          priority: SEAT_PRIORITY,
          locale: NS,
          inject: (sessionId): SeatInjected => {
            const directory = models.directoryFor(sessionId)
            const available = sessions.subagentAddress(sessionId) === undefined
            const face: SeatInjected = {
              available,
              directory: directory.store,
              load: () => {
                if (available) void directory.load().catch(() => { /* surfaced on the shared store */ })
              },
              select: selection => available ? directory.select(selection) : Promise.resolve(undefined),
              resolveText: text => scope.locale.resolveText(text),
            }
            if (teamRemote !== undefined) {
              const team = teamRemote
              face.setTeamEnabled = enabled => team.setEnabled(sessionId, enabled)
                .then(result => result.ok ? null : result.error.message)
            }
            return face
          },
        }, FastModelSelector))
      })
    }

    return {
      inject: ['slots', 'locale', 'sessions', 'modelDirectories', 'remote'],
      apply,
    }
  },
})
