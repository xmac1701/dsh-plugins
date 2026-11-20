/**
 * Browser entry for the fast model selector. It shadows the native composer
 * model seat at a lower slot priority and renders the two-column panel from
 * the shared per-session ModelDirectory, so switches made here, through the
 * /model command, or by a settings/catalog refresh all stay in sync.
 */
import { createSeat, parseFavorites, type ModelDirectoryState, type ReactDOMLike, type ReactLike, type RemoteResult, type SeatInjected, type Selection, type SnapshotStore } from './seat'
import { en, NS, zh } from './locales'
import { CSS } from './theme'

const PLUGIN_ID = 'dsh-plugin-fast-model-selector'
const STYLE_ID = `${PLUGIN_ID}/theme.css`
/** Native seat registers at the default priority 0; a lower priority shadows it. */
const SEAT_PRIORITY = -2
/** Settings namespace = the Host bundle row id in cordis.patch.yml. */
const FAVORITES_NAMESPACE = 'fast-model-selector'

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

interface SettingsNamespaceViewLike {
  ns: string
  revision: number
  value: unknown
}

interface SettingsDescribeValueLike {
  namespaces: readonly SettingsNamespaceViewLike[]
}

interface SettingsRemoteFace {
  describe(): Promise<RemoteResult<SettingsDescribeValueLike>>
  update(
    ns: string,
    patch: Record<string, unknown>,
    expectedRevision: number | undefined,
  ): Promise<RemoteResult<unknown>>
}

interface RemoteFace {
  agentTeams?: TeamRemoteFace
  settings?: SettingsRemoteFace
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

        let settingsRemote: SettingsRemoteFace | undefined
        try {
          settingsRemote = scope.get('remote.settings') as SettingsRemoteFace | undefined
        } catch {
          settingsRemote = undefined
        }
        scope.inject(['remote.settings'], (settingsScope) => {
          settingsRemote = settingsScope.remote.settings
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
            face.loadFavorites = async () => {
              const remote = settingsRemote
              if (remote === undefined) throw new Error('DSH settings is unavailable')
              const described = await remote.describe()
              if (!described.ok) {
                throw new Error(`${described.error.code}: ${described.error.message}`)
              }
              const namespace = described.value.namespaces.find(view => view.ns === FAVORITES_NAMESPACE)
              if (namespace === undefined) throw new Error('favorites settings namespace is unavailable')
              return parseFavorites(namespace.value)
            }
            face.saveFavorites = async (favorites) => {
              const remote = settingsRemote
              if (remote === undefined) return 'settings unavailable'
              for (let attempt = 0; attempt < 2; attempt += 1) {
                const described = await remote.describe()
                if (!described.ok) return `${described.error.code}: ${described.error.message}`
                const namespace = described.value.namespaces.find(view => view.ns === FAVORITES_NAMESPACE)
                if (namespace === undefined) return 'settings namespace unavailable'
                const written = await remote.update(
                  FAVORITES_NAMESPACE,
                  { favorites: [...favorites] },
                  namespace.revision,
                )
                if (written.ok) return null
                if (written.error.code === 'settings/conflict' && attempt === 0) continue
                return `${written.error.code}: ${written.error.message}`
              }
              return 'settings conflict'
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
