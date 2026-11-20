/**
 * Browser half of the fast model selector. Everything here is created inside
 * the module-loader factory so React and ReactDOM come from the page's
 * platform module table, never from a bundled copy.
 *
 * The seat renders two columns over the shared ModelDirectory (the same
 * per-session store the /model command uses): the left column is the
 * provider-grouped model list, the right column is the reasoning list for the
 * highlighted model. The current pair is bold with a leading check. Hovering
 * or focusing a model only changes the right column; clicking an effort
 * submits the complete selection.
 */

/** One complete model selection. */
export interface Selection {
  provider: string
  model: string
  reasoningEffort?: string
}

/** One adapter-owned reasoning effort. */
export interface ReasoningEffort {
  id: string
  name: string
  description?: string
}

/** Recognized reasoning metadata for one model route. */
export interface ModelReasoning {
  efforts: readonly ReasoningEffort[]
  defaultEffort?: string
}

/** Provider-authored label beside a model name. */
export interface ModelBadge {
  text: unknown
}

/** One catalog model. */
export interface CatalogModel {
  id: string
  name: string
  reasoning?: ModelReasoning
  badge?: ModelBadge
}

/** One provider and its catalog. */
export interface ProviderGroup {
  id: string
  name: string
  models: readonly CatalogModel[]
}

/** One provider whose catalog failed to load. */
export interface CatalogFailure {
  id: string
  name: string
  message: string
}

/** Snapshot both selector entries render from. */
export interface ModelDirectoryState {
  current: Selection | null
  retainedEffort?: string
  routable: boolean | null
  groups: readonly ProviderGroup[]
  failures: readonly CatalogFailure[]
  status: 'idle' | 'loading' | 'ready' | 'selecting' | 'error'
  pending: Selection | null
  error: string | null
}

/** Minimal observable store contract. */
export interface SnapshotStore<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** Minimal remote result. */
export interface RemoteError {
  code: string
  message: string
}

/** Host selection outcome. */
export type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: RemoteError }

/** Agent-team projection fields this seat reads. */
export interface TeamProjection {
  enabled: boolean
}

/** Durable model-selection projection fields this seat reads. */
export interface ModelSelectionProjection {
  lastUsed: Selection | null
  next: Selection | null
}

/** Business face injected per Session by the Client plugin. */
export interface SeatInjected {
  /** Whether Agent-bound model operations are available (false for addressed subagents). */
  available: boolean
  /** The shared per-session directory store. */
  directory: SnapshotStore<ModelDirectoryState>
  /** Advisory catalog load; no-op once ready. */
  load: () => void
  /** Submit one complete selection. */
  select: (selection: Selection) => Promise<RemoteResult<void> | undefined>
  /** Resolve a provider-authored badge text. */
  resolveText: (text: unknown) => string
  /** Save the Agent Teams selection; null on success, otherwise the failure text. */
  setTeamEnabled?: (enabled: boolean) => Promise<string | null>
  /** Read favorites from the DSH settings namespace; absent when settings is unavailable. */
  loadFavorites?: () => Promise<readonly Selection[]>
  /** Persist favorites through DSH settings; null on success, otherwise the failure text. */
  saveFavorites?: (favorites: readonly Selection[]) => Promise<string | null>
}

/** Localized translate seat. */
export type Translate = (key: string, params?: Record<string, string | number>) => string

/** Standard session projection hooks (erased local surface). */
export type UseProjection = (key: string) => unknown
export type UseSession = (selector: (snapshot: unknown) => unknown) => unknown
export type UseSessions = (selector: (snapshot: unknown) => unknown) => unknown

/** Full props the renderer merges into the seat. */
export interface SeatProps extends SeatInjected {
  locked: boolean
  sessionId: string
  t: Translate
  useProjection: UseProjection
  useSession: UseSession
  useSessions: UseSessions
}

/** Minimal React surface used by the seat. */
export interface ReactLike {
  createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown
  useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void]
  useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  useMemo<T>(factory: () => T, deps: readonly unknown[]): T
  useRef<T>(initial: T): { current: T }
  useSyncExternalStore<T>(subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => T): T
  useId(): string
  memo<T>(component: (props: T) => unknown): (props: T) => unknown
}

/** Minimal ReactDOM surface used by the seat. */
export interface ReactDOMLike {
  createPortal(children: unknown, container: Element): unknown
}

interface KeyboardLikeEvent {
  key: string
  shiftKey: boolean
  nativeEvent?: { isComposing?: boolean }
  preventDefault(): void
  stopPropagation(): void
  target: EventTarget | null
}

interface MouseLikeEvent {
  target: EventTarget | null
  preventDefault(): void
  stopPropagation(): void
}

interface FocusLikeEvent {
  relatedTarget: EventTarget | null
}

interface EffortChoice {
  key: string
  effort: string | undefined
  label: string
  description?: string
}

interface ModelEntry {
  key: string
  groupId: string
  providerName: string
  model: CatalogModel
  badgeText: string | undefined
  /** Position in the currently visible model order (DOM data-model-index). */
  index: number
}

interface Point {
  x: number
  y: number
}

interface GroupView {
  id: string
  name: string
  models: readonly { entry: ModelEntry; index: number }[]
}

interface ModelView {
  groups: readonly GroupView[]
  entries: readonly ModelEntry[]
  byKey: Map<string, ModelEntry>
}

interface CurrentInfo {
  group: ProviderGroup
  model: CatalogModel
}

interface FavoriteChip {
  key: string
  selection: Selection
  /** Display name: model · effort. */
  name: string
  modelName: string
  providerName: string
  effortLabel: string
  /** Whether the model is present in the current catalog. */
  available: boolean
}

const EMPTY_VIEW: ModelView = { groups: [], entries: [], byKey: new Map() }

interface PanelPosition {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
}

interface ModelRowProps {
  entry: ModelEntry
  index: number
  active: boolean
  current: boolean
  pending: boolean
  disabled: boolean
}

/** Join truthy class names. */
function classes(...values: readonly (string | false | null | undefined)[]): string {
  return values.filter((value): value is string => typeof value === 'string' && value !== '').join(' ')
}

/** Stable display key for a provider/model pair. */
function modelKey(provider: string, model: string): string {
  return JSON.stringify([provider, model])
}

/** Account and official providers first, preserving catalog order otherwise. */
function orderGroups(groups: readonly ProviderGroup[]): ProviderGroup[] {
  const rank = (id: string): number => id === 'deepseek-account' ? 0 : id === 'deepseek-official' ? 1 : 2
  return groups
    .map(group => ({ group, rank: rank(group.id) }))
    .sort((left, right) => left.rank - right.rank)
    .map(item => item.group)
}

/** Effective effort rows for one model; models without routing metadata still get a clickable default. */
function effortsFor(model: CatalogModel, t: Translate): EffortChoice[] {
  const reasoning = model.reasoning
  if (reasoning === undefined || reasoning.efforts.length === 0) {
    return [{
      key: 'model-default',
      effort: reasoning?.defaultEffort,
      label: t('effort.providerDefault'),
    }]
  }
  const choices: EffortChoice[] = []
  if (reasoning.defaultEffort === undefined) {
    choices.push({ key: 'provider-default', effort: undefined, label: t('effort.providerDefault') })
  }
  for (const level of reasoning.efforts) {
    choices.push({
      key: `effort:${level.id}`,
      effort: level.id,
      label: level.name,
      ...level.description === undefined ? {} : { description: level.description },
    })
  }
  return choices
}

/** The effort a model can actually display; no-metadata models use the default row. */
function effectiveEffort(model: CatalogModel | undefined, selection: Selection | null): string | undefined {
  if (model === undefined || selection === null) return undefined
  const reasoning = model.reasoning
  if (reasoning === undefined) return undefined
  if (reasoning.efforts.length === 0) return reasoning.defaultEffort
  return selection.reasoningEffort ?? reasoning.defaultEffort
}

/** Scroll one row to the nearest edge of its scrolling body without moving the page. */
function revealRow(container: HTMLElement | null, row: HTMLElement | null): void {
  if (container === null || row === null) return
  const box = container.getBoundingClientRect()
  const target = row.getBoundingClientRect()
  if (target.top < box.top) container.scrollTop -= box.top - target.top
  else if (target.bottom > box.bottom) container.scrollTop += target.bottom - box.bottom
}

/** Convert an unknown thrown value to display text. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Stable identity of one complete selection (undefined effort included). */
function favoriteKey(selection: Selection): string {
  return JSON.stringify([selection.provider, selection.model, selection.reasoningEffort ?? null])
}

/** Validate the `favorites` field of the plugin's DSH settings namespace. */
export function parseFavorites(value: unknown): readonly Selection[] {
  if (typeof value !== 'object' || value === null) return []
  const parsed = (value as { favorites?: unknown }).favorites
  if (!Array.isArray(parsed)) return []
  const seen = new Set<string>()
  const favorites: Selection[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const item = entry as { provider?: unknown; model?: unknown; reasoningEffort?: unknown }
    if (typeof item.provider !== 'string' || typeof item.model !== 'string') continue
    if (item.reasoningEffort !== undefined && typeof item.reasoningEffort !== 'string') continue
    const selection: Selection = {
      provider: item.provider,
      model: item.model,
      ...item.reasoningEffort === undefined ? {} : { reasoningEffort: item.reasoningEffort },
    }
    const key = favoriteKey(selection)
    if (seen.has(key)) continue
    seen.add(key)
    favorites.push(selection)
  }
  return favorites
}

/** The element an event targets, or null for non-element targets. */
function targetElement(event: unknown): Element | null {
  const target = (event as { target?: unknown } | null | undefined)?.target
  return target instanceof Element ? target : null
}

/** Read the numeric row index from an event inside `container`, or null. */
function rowIndexIn(container: HTMLElement | null, event: unknown, attribute: string): number | null {
  const row = targetElement(event)?.closest<HTMLElement>(`[${attribute}]`) ?? null
  if (row === null || container?.contains(row) !== true) return null
  const raw = row.getAttribute(attribute)
  if (raw === null) return null
  const index = Number(raw)
  return Number.isInteger(index) ? index : null
}

/** Create the seat component with the page's React/ReactDOM instances. */
export function createSeat(React: ReactLike, ReactDOM: ReactDOMLike): (props: SeatProps) => unknown {
  const h = React.createElement

  function CheckIcon() {
    return h('svg', { viewBox: '0 0 16 16', 'aria-hidden': true, focusable: 'false' },
      h('path', {
        d: 'M3.2 8.4l3 3 6.6-7',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 1.6,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }))
  }

  function ChevronIcon(props: { open?: boolean }) {
    return h('svg', {
      viewBox: '0 0 16 16',
      width: 12,
      height: 12,
      'aria-hidden': true,
      focusable: 'false',
      className: classes('fms-chevron', props.open === true && 'fms-chevronOpen'),
    }, h('path', {
      d: 'M4 6l4 4 4-4',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }))
  }

  function RowChevronIcon() {
    return h('svg', {
      viewBox: '0 0 16 16',
      className: 'fms-optionChevron',
      'aria-hidden': true,
      focusable: 'false',
    }, h('path', {
      d: 'M6 3.5L10.5 8 6 12.5',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.4,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }))
  }

  function TriggerIcon() {
    return h('svg', {
      viewBox: '0 0 16 16',
      width: 14,
      height: 14,
      className: 'fms-triggerIcon',
      'aria-hidden': true,
      focusable: 'false',
    },
    h('rect', { x: 2, y: 3, width: 5, height: 10, rx: 1.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3 }),
    h('rect', { x: 9, y: 3, width: 5, height: 10, rx: 1.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3 }),
    h('path', { d: 'M4 6.3l.8.8 1.4-1.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
  }

  function Spinner() {
    return h('span', { className: 'fms-spinner', 'aria-hidden': true })
  }

  function StarIcon(props: { filled: boolean }) {
    return h('svg', {
      viewBox: '0 0 16 16',
      width: 14,
      height: 14,
      'aria-hidden': true,
      focusable: 'false',
    }, h('path', {
      d: 'M8 1.9l1.86 3.77 4.16.61-3.01 2.94.71 4.14L8 11.4l-3.72 1.95.71-4.14L2 6.28l4.16-.61L8 1.9z',
      fill: props.filled ? 'currentColor' : 'none',
      stroke: 'currentColor',
      'stroke-width': 1.2,
      'stroke-linejoin': 'round',
    }))
  }

  const ProviderHeader = React.memo(function ProviderHeader(props: { name: string }) {
    return h('div', { className: 'fms-groupHeader', 'aria-hidden': true }, h('span', null, props.name))
  })

  interface GroupBlockProps {
    group: GroupView
    activeKey: string | null
    currentKey: string | null
    pendingKey: string | null
    disabled: boolean
  }

  const ModelRow = React.memo(function ModelRow(props: ModelRowProps) {
    const { entry } = props
    return h('button', {
      type: 'button',
      'aria-current': props.current ? 'true' : undefined,
      'data-model-index': props.index,
      'data-model-current': props.current ? '' : undefined,
      'data-model-active': props.active ? '' : undefined,
      tabIndex: props.active ? 0 : -1,
      disabled: props.disabled,
      title: entry.model.name,
      className: classes(
        'fms-option',
        'fms-modelOption',
        props.active && 'fms-optionActive',
        props.current && 'fms-optionCurrent',
      ),
    },
    h('span', { className: 'fms-check', 'aria-hidden': true }, props.pending ? h(Spinner) : props.current ? h(CheckIcon) : null),
    h('span', { className: 'fms-name' }, entry.model.name),
    entry.badgeText === undefined ? null : h('span', { className: 'fms-badge', title: entry.badgeText }, entry.badgeText),
    props.active ? h(RowChevronIcon) : null)
  })

  const GroupBlock = React.memo(function GroupBlock(props: GroupBlockProps) {
    const rows: unknown[] = [h(ProviderHeader, { key: `header:${props.group.id}`, name: props.group.name })]
    for (const item of props.group.models) {
      rows.push(h(ModelRow, {
        key: item.entry.key,
        entry: item.entry,
        index: item.index,
        active: props.activeKey === item.entry.key,
        current: props.currentKey === item.entry.key,
        pending: props.pendingKey === item.entry.key,
        disabled: props.disabled,
      }))
    }
    return h('div', {
      className: 'fms-group',
      role: 'group',
      'aria-label': props.group.name,
    }, rows)
  })

  /** The two-column seat. */
  function FastModelSelector(props: SeatProps): unknown {
    const { locked, available, directory, load, select, resolveText, setTeamEnabled, t } = props
    const state = React.useSyncExternalStore(
      listener => directory.subscribe(listener),
      () => directory.getSnapshot(),
    )
    const team = props.useProjection('agentTeam') as TeamProjection | undefined
    const modelProjection = props.useProjection('modelSelection') as ModelSelectionProjection | undefined
    const addressedChild = props.useSession(snapshot => (snapshot as { subagent?: unknown }).subagent != null) === true
    const listedChild = props.useSessions((snapshot) => {
      const entry = (snapshot as { byId?: Record<string, { origin?: string } | undefined> }).byId?.[props.sessionId]
      return entry?.origin === 'subagent'
    }) === true

    const [open, setOpen] = React.useState<boolean>(false)
    const [activeKey, setActiveKey] = React.useState<string | null>(null)
    const [favorites, setFavorites] = React.useState<readonly Selection[]>([])
    const [favoritesReady, setFavoritesReady] = React.useState<boolean>(false)
    const [query, setQuery] = React.useState<string>('')
    const [position, setPosition] = React.useState<PanelPosition | null>(null)
    const [failure, setFailure] = React.useState<string | null>(null)
    const [confirmTeamOff, setConfirmTeamOff] = React.useState<boolean>(false)
    const [teamPending, setTeamPending] = React.useState<boolean>(false)
    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const triggerRef = React.useRef<HTMLButtonElement | null>(null)
    const panelRef = React.useRef<HTMLDivElement | null>(null)
    const modelBodyRef = React.useRef<HTMLDivElement | null>(null)
    const effortBodyRef = React.useRef<HTMLDivElement | null>(null)
    const searchRef = React.useRef<HTMLInputElement | null>(null)
    const teamRowRef = React.useRef<HTMLButtonElement | null>(null)
    const confirmCancelRef = React.useRef<HTMLButtonElement | null>(null)
    // Menu-aim state: recent pointer locations, the row under the pointer, the
    // pending delayed activation, and the latest activation logic. See
    // https://github.com/kamens/jQuery-menu-aim.
    const mouseLocsRef = React.useRef<Point[]>([])
    const aimTimerRef = React.useRef<number | null>(null)
    const hoveredRowRef = React.useRef<string | null>(null)
    const lastDelayLocRef = React.useRef<Point | null>(null)
    const aimActiveKeyRef = React.useRef<string | null>(null)
    const aimRef = React.useRef<{ possiblyActivate: (key: string) => void }>({ possiblyActivate: () => {} })
    const focusPendingRef = React.useRef<boolean>(false)
    const prefetchedRef = React.useRef<boolean>(false)
    const lastActionRef = React.useRef<'load' | 'select' | 'team'>('load')
    const favoritesLoadRef = React.useRef<boolean>(false)
    const favoritesSaveRef = React.useRef<Promise<void>>(Promise.resolve())
    const panelId = React.useId()
    const modelListId = `${panelId}-models`

    const accountName = t('provider.account')
    const current = state.current
    const totalModels = React.useMemo(
      () => state.groups.reduce((count, group) => count + group.models.length, 0),
      [state.groups],
    )
    const showSearch = totalModels > 4
    const favoriteKeys = React.useMemo(() => new Set(favorites.map(favoriteKey)), [favorites])
    const favoriteChips = React.useMemo<readonly FavoriteChip[]>(() => favorites.map((favorite) => {
      let group: ProviderGroup | undefined
      let model: CatalogModel | undefined
      for (const candidate of state.groups) {
        if (candidate.id !== favorite.provider) continue
        group = candidate
        model = candidate.models.find(entry => entry.id === favorite.model)
        break
      }
      const modelName = model?.name ?? favorite.model
      const providerName = group === undefined
        ? favorite.provider
        : group.id === 'deepseek-account' ? accountName : group.name
      const effortLabel = favorite.reasoningEffort === undefined
        ? t('effort.providerDefault')
        : model?.reasoning?.efforts.find(level => level.id === favorite.reasoningEffort)?.name
          ?? favorite.reasoningEffort
      return {
        key: favoriteKey(favorite),
        selection: favorite,
        name: `${modelName} · ${effortLabel}`,
        modelName,
        providerName,
        effortLabel,
        available: model !== undefined,
      }
    }), [favorites, state.groups, accountName, t])

    // The trigger only needs the current route. Scan for it without building
    // the full per-model entry table, so a large catalog costs nothing while
    // the panel is closed.
    const currentInfo = React.useMemo<CurrentInfo | undefined>(() => {
      if (current === null) return undefined
      for (const group of state.groups) {
        if (group.id !== current.provider) continue
        const model = group.models.find(candidate => candidate.id === current.model)
        return model === undefined ? undefined : { group, model }
      }
      return undefined
    }, [current, state.groups])

    // Defer the heavy provider/entry/Map construction until the panel is
    // actually open. The catalog can load at boot; this keeps its size off the
    // startup path.
    const view = React.useMemo<ModelView>(() => {
      if (!open) return EMPTY_VIEW
      const needle = showSearch ? query.trim().toLowerCase() : ''
      let index = 0
      const entries: ModelEntry[] = []
      const groups = orderGroups(state.groups).map((group) => {
        const providerName = group.id === 'deepseek-account' ? accountName : group.name
        const providerMatches = needle !== '' && (
          group.name.toLowerCase().includes(needle)
          || (group.id === 'deepseek-account' && accountName.toLowerCase().includes(needle))
        )
        const models = group.models
          .filter(model => needle === '' || providerMatches || model.name.toLowerCase().includes(needle))
          .map((model) => {
            const entry: ModelEntry = {
              key: modelKey(group.id, model.id),
              groupId: group.id,
              providerName,
              model,
              badgeText: model.badge === undefined ? undefined : resolveText(model.badge.text),
              index,
            }
            entries.push(entry)
            const item = { entry, index }
            index += 1
            return item
          })
        return { id: group.id, name: providerName, models }
      }).filter(group => group.models.length > 0)
      return { groups, entries, byKey: new Map(entries.map(entry => [entry.key, entry])) }
    }, [open, state.groups, accountName, resolveText, showSearch, query])

    const currentKey = currentInfo === undefined ? null : modelKey(currentInfo.group.id, currentInfo.model.id)
    const currentEntry = currentKey === null ? undefined : view.byKey.get(currentKey)
    const activeEntry = (activeKey === null ? undefined : view.byKey.get(activeKey)) ?? currentEntry ?? view.entries[0]
    aimActiveKeyRef.current = activeEntry?.key ?? null
    const currentReasoning = currentInfo?.model.reasoning
    const currentEffort = effectiveEffort(currentInfo?.model, current)
    const currentUnavailable = current !== null && currentInfo === undefined
      && state.status === 'ready' && state.groups.length > 0
    const effortLabel = currentInfo === undefined
      ? undefined
      : currentReasoning === undefined || currentReasoning.efforts.length === 0
        ? t('effort.providerDefault')
        : currentEffort === undefined
          ? t('effort.providerDefault')
          : currentReasoning.efforts.find(level => level.id === currentEffort)?.name ?? currentEffort
    const activeIsCurrent = activeEntry !== undefined && currentEntry !== undefined && activeEntry.key === currentEntry.key
    const activeEffort = activeIsCurrent ? effectiveEffort(activeEntry?.model, current) : undefined
    const activeEfforts = React.useMemo<readonly EffortChoice[]>(
      () => activeEntry === undefined ? [] : effortsFor(activeEntry.model, t),
      [activeEntry, t],
    )
    const effortTabStop = activeIsCurrent
      ? activeEfforts.findIndex(choice => choice.effort === activeEffort)
      : 0
    const effortTabIndex = effortTabStop < 0 ? 0 : effortTabStop

    const pending = state.pending
    const pendingKey = pending === null ? null : modelKey(pending.provider, pending.model)
    const pendingEntry = pendingKey === null ? undefined : view.byKey.get(pendingKey)
    const pendingEffort = effectiveEffort(pendingEntry?.model, pending)
    const pendingIsActive = pending !== null && activeEntry !== undefined
      && pending.provider === activeEntry.groupId && pending.model === activeEntry.model.id
    const busy = pending !== null || state.status === 'selecting'
    const waiting = state.groups.length === 0 && state.status === 'loading'
    const teamAvailable = team !== undefined && setTeamEnabled !== undefined && !addressedChild && !listedChild
    const teamEnabled = team?.enabled === true

    const prefetch = (): void => {
      if (prefetchedRef.current) return
      prefetchedRef.current = true
      lastActionRef.current = 'load'
      load()
    }

    const clearAimTimer = (): void => {
      if (aimTimerRef.current !== null) {
        window.clearTimeout(aimTimerRef.current)
        aimTimerRef.current = null
      }
    }

    const resetAim = (): void => {
      clearAimTimer()
      mouseLocsRef.current = []
      lastDelayLocRef.current = null
      hoveredRowRef.current = null
    }

    const ensureFavoritesLoaded = (): void => {
      if (favoritesLoadRef.current) return
      favoritesLoadRef.current = true
      const loader = props.loadFavorites
      if (loader === undefined) {
        setFavoritesReady(true)
        return
      }
      void loader().then((loaded) => {
        setFavorites(loaded)
        setFavoritesReady(true)
      }, (error: unknown) => {
        setFavoritesReady(true)
        setFailure(t('favorite.loadFailed', { message: messageOf(error) }))
      })
    }

    const close = (restoreFocus: boolean): void => {
      resetAim()
      setOpen(false)
      setPosition(null)
      setQuery('')
      setConfirmTeamOff(false)
      setFailure(null)
      focusPendingRef.current = false
      if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus() })
    }

    const dismissConfirm = (): void => {
      // The confirmation unmounts its focused cancel button; park focus on the
      // switch that stays mounted first so the panel does not blur/close.
      teamRowRef.current?.focus({ preventScroll: true })
      setConfirmTeamOff(false)
    }

    const show = (): void => {
      resetAim()
      setFailure(null)
      setConfirmTeamOff(false)
      setPosition(null)
      setQuery('')
      setActiveKey(currentKey)
      focusPendingRef.current = true
      setOpen(true)
      lastActionRef.current = 'load'
      ensureFavoritesLoaded()
      load()
    }

    const reload = (): void => {
      lastActionRef.current = 'load'
      setFailure(null)
      load()
    }

    const submit = (selection: Selection): void => {
      lastActionRef.current = 'select'
      setFailure(null)
      // Move focus out of the option rows before `select` disables them.
      triggerRef.current?.focus()
      void (async () => {
        try {
          const result = await select(selection)
          if (result === undefined) return
          if (result.ok) {
            close(true)
            return
          }
          setFailure(result.error.code === 'session/writer-held'
            ? t('error.sessionInUse')
            : t('error.action', { message: `${result.error.code}: ${result.error.message}` }))
        } catch (error) {
          setFailure(t('error.action', { message: messageOf(error) }))
        }
      })()
    }

    const chooseEffort = (choice: EffortChoice): void => {
      if (activeEntry === undefined || busy || locked) return
      if (activeIsCurrent && choice.effort === activeEffort) {
        close(true)
        return
      }
      submit({
        provider: activeEntry.groupId,
        model: activeEntry.model.id,
        ...choice.effort === undefined ? {} : { reasoningEffort: choice.effort },
      })
    }

    const toggleFavorite = (selection: Selection): void => {
      if (!favoritesReady) return
      const key = favoriteKey(selection)
      const next = favorites.some(item => favoriteKey(item) === key)
        ? favorites.filter(item => favoriteKey(item) !== key)
        : [...favorites, selection]
      setFavorites(next)
      const save = props.saveFavorites
      if (save === undefined) return
      // Serialize writes so the newest array lands last even on rapid clicks.
      favoritesSaveRef.current = favoritesSaveRef.current.then(async () => {
        try {
          const failureText = await save(next)
          if (failureText !== null) setFailure(t('favorite.saveFailed', { message: failureText }))
        } catch (error) {
          setFailure(t('favorite.saveFailed', { message: messageOf(error) }))
        }
      })
    }

    const chooseFavorite = (chip: FavoriteChip): void => {
      if (!chip.available || busy || locked) return
      if (state.current !== null && favoriteKey(state.current) === chip.key) {
        close(true)
        return
      }
      submit(chip.selection)
    }

    const applyTeam = (enabled: boolean): void => {
      if (setTeamEnabled === undefined || busy || locked) return
      lastActionRef.current = 'team'
      // Keep focus inside the seat while the switch row is disabled.
      triggerRef.current?.focus()
      setConfirmTeamOff(false)
      setTeamPending(true)
      setFailure(null)
      void (async () => {
        try {
          const teamFailure = await setTeamEnabled(enabled)
          if (teamFailure !== null) setFailure(t('team.failed', { message: teamFailure }))
        } catch (error) {
          setFailure(t('team.failed', { message: messageOf(error) }))
        } finally {
          setTeamPending(false)
        }
      })()
    }

    const toggleTeam = (): void => {
      if (!teamAvailable || busy || locked || teamPending) return
      if (teamEnabled && modelProjection?.lastUsed != null) {
        setConfirmTeamOff(true)
        return
      }
      applyTeam(!teamEnabled)
    }

    const activateModel = (key: string, transferFocus: boolean): void => {
      const entry = view.byKey.get(key)
      if (entry === undefined) return
      if (key !== activeKey) setActiveKey(key)
      if (!transferFocus) return
      // Changing the active model replaces the effort pane. If keyboard focus
      // sits on an effort row, that row would unmount, blur to the document,
      // and close the panel; park focus on the model row first. Other focused
      // controls remain mounted, so they keep focus.
      const focused = document.activeElement
      if (focused instanceof Node && effortBodyRef.current?.contains(focused) === true) {
        const row = modelBodyRef.current?.querySelector<HTMLElement>(`[data-model-index="${entry.index}"]`)
        row?.focus({ preventScroll: true })
      }
    }

    /** Click/keyboard: activate now and put focus on the chosen model row. */
    const activateImmediately = (key: string): void => {
      clearAimTimer()
      hoveredRowRef.current = key
      const entry = view.byKey.get(key)
      if (entry === undefined) return
      activateModel(key, true)
      const row = modelBodyRef.current?.querySelector<HTMLElement>(`[data-model-index="${entry.index}"]`)
      row?.focus({ preventScroll: true })
    }

    const focusModel = (index: number): void => {
      const entry = view.entries[index]
      if (entry === undefined) return
      clearAimTimer()
      activateModel(entry.key, false)
      const row = modelBodyRef.current?.querySelector<HTMLElement>(`[data-model-index="${index}"]`)
      if (row) {
        row.focus({ preventScroll: true })
        revealRow(modelBodyRef.current, row)
      }
    }

    const focusEffort = (index: number): void => {
      const row = effortBodyRef.current?.querySelector<HTMLElement>(`[data-effort-index="${index}"]`)
      if (row) {
        row.focus({ preventScroll: true })
        revealRow(effortBodyRef.current, row)
      }
    }

    const focusActiveEffort = (): void => {
      const row = effortBodyRef.current?.querySelector<HTMLElement>('[data-effort-current]')
        ?? effortBodyRef.current?.querySelector<HTMLElement>('[data-effort-index="0"]')
      if (row) {
        row.focus({ preventScroll: true })
        revealRow(effortBodyRef.current, row)
      }
    }

    const focusActiveModel = (): void => {
      const row = modelBodyRef.current?.querySelector<HTMLElement>('.fms-optionActive')
        ?? modelBodyRef.current?.querySelector<HTMLElement>('[data-model-current]')
      if (row) {
        row.focus({ preventScroll: true })
        revealRow(modelBodyRef.current, row)
      } else {
        focusModel(0)
      }
    }

    /**
     * Menu-aim activation delay (adapted from jQuery-menu-aim): while the
     * pointer is moving toward the effort pane, crossing other model rows must
     * not switch the active model. A delay is returned until the pointer stops
     * or changes direction, then the hovered row activates.
     */
    const activationDelay = (): number => {
      if (aimActiveKeyRef.current === null) return 0
      const body = modelBodyRef.current
      if (body === null) return 0
      const rect = body.getBoundingClientRect()
      const tolerance = 75
      const upperRight: Point = { x: rect.right, y: rect.top - tolerance }
      const lowerRight: Point = { x: rect.right, y: rect.bottom + tolerance }
      const locations = mouseLocsRef.current
      const location = locations[locations.length - 1]
      if (location === undefined) return 0
      const previous = locations[0] ?? location
      // Entering the model list from outside (including from the effort pane)
      // is an intentional move: activate immediately.
      if (previous.x < rect.left || previous.x > rect.right
        || previous.y < rect.top || previous.y > rect.bottom) return 0
      const lastDelay = lastDelayLocRef.current
      if (lastDelay !== null && location.x === lastDelay.x && location.y === lastDelay.y) return 0
      const slope = (from: Point, to: Point): number => (to.y - from.y) / (to.x - from.x)
      const decreasing = slope(location, upperRight)
      const increasing = slope(location, lowerRight)
      const previousDecreasing = slope(previous, upperRight)
      const previousIncreasing = slope(previous, lowerRight)
      if (decreasing < previousDecreasing && increasing > previousIncreasing) {
        // Both right-hand slopes are diverging: the pointer is heading into
        // the submenu. Re-check after the delay instead of switching.
        lastDelayLocRef.current = location
        return 200
      }
      lastDelayLocRef.current = null
      return 0
    }

    const possiblyActivate = (key: string): void => {
      if (!open) return
      if (key === aimActiveKeyRef.current) return
      const delay = activationDelay()
      if (delay > 0) {
        aimTimerRef.current = window.setTimeout(() => {
          aimTimerRef.current = null
          if (hoveredRowRef.current === key) aimRef.current.possiblyActivate(key)
        }, delay)
        return
      }
      activateModel(key, true)
    }

    // The latest activation logic for timers scheduled by an older render.
    aimRef.current.possiblyActivate = possiblyActivate

    const pushMouseLoc = (x: number, y: number): void => {
      const locations = mouseLocsRef.current
      locations.push({ x, y })
      if (locations.length > 3) locations.shift()
    }

    const resetHoverAim = (): void => {
      hoveredRowRef.current = null
      clearAimTimer()
    }

    const onPanelMouseLeave = (): void => {
      resetHoverAim()
      // Re-entering from outside starts a fresh direction sample.
      mouseLocsRef.current = []
    }

    const onPanelMouseMove = (event: unknown): void => {
      const pointer = event as { clientX?: unknown; clientY?: unknown }
      if (typeof pointer.clientX !== 'number' || typeof pointer.clientY !== 'number') return
      pushMouseLoc(pointer.clientX, pointer.clientY)
      if (busy) {
        resetHoverAim()
        return
      }
      const index = rowIndexIn(modelBodyRef.current, event, 'data-model-index')
      const entry = index === null ? undefined : view.entries[index]
      if (entry === undefined) {
        resetHoverAim()
        return
      }
      if (entry.key === hoveredRowRef.current) return
      hoveredRowRef.current = entry.key
      clearAimTimer()
      if (entry.key === aimActiveKeyRef.current) return
      aimRef.current.possiblyActivate(entry.key)
    }

    const onModelFocus = (event: unknown): void => {
      if (busy) return
      const index = rowIndexIn(modelBodyRef.current, event, 'data-model-index')
      if (index === null) return
      const entry = view.entries[index]
      if (entry === undefined) return
      clearAimTimer()
      activateModel(entry.key, false)
    }

    const onModelClick = (event: unknown): void => {
      if (busy || locked) return
      const index = rowIndexIn(modelBodyRef.current, event, 'data-model-index')
      if (index === null) return
      const entry = view.entries[index]
      if (entry !== undefined) activateImmediately(entry.key)
    }

    const onSearchChange = (event: unknown): void => {
      const target = (event as { target?: unknown }).target
      if (target instanceof HTMLInputElement) setQuery(target.value)
    }

    const onSearchKeyDown = (event: unknown): void => {
      const keyEvent = event as KeyboardLikeEvent
      if (keyEvent.nativeEvent?.isComposing === true) return
      if (keyEvent.key === 'ArrowDown' || keyEvent.key === 'ArrowUp') {
        keyEvent.preventDefault()
        if (view.entries.length === 0) return
        focusModel(keyEvent.key === 'ArrowDown' ? 0 : view.entries.length - 1)
        return
      }
      if (keyEvent.key === 'Enter') {
        keyEvent.preventDefault()
        focusActiveEffort()
      }
    }

    const clearSearch = (): void => {
      setQuery('')
      searchRef.current?.focus()
    }

    const onModelKeyDown = (event: unknown): void => {
      const keyEvent = event as KeyboardLikeEvent
      if (keyEvent.nativeEvent?.isComposing === true) return
      const index = rowIndexIn(modelBodyRef.current, event, 'data-model-index')
      if (index === null) return
      if (view.entries.length === 0) return
      if (keyEvent.key === 'ArrowDown' || keyEvent.key === 'ArrowUp') {
        keyEvent.preventDefault()
        const delta = keyEvent.key === 'ArrowDown' ? 1 : -1
        focusModel((index + delta + view.entries.length) % view.entries.length)
        return
      }
      if (keyEvent.key === 'Home' || keyEvent.key === 'End') {
        keyEvent.preventDefault()
        focusModel(keyEvent.key === 'Home' ? 0 : view.entries.length - 1)
        return
      }
      if (keyEvent.key === 'ArrowRight' || keyEvent.key === 'Enter') {
        keyEvent.preventDefault()
        focusActiveEffort()
      }
    }

    const onEffortKeyDown = (event: unknown): void => {
      const keyEvent = event as KeyboardLikeEvent
      if (keyEvent.nativeEvent?.isComposing === true) return
      const index = rowIndexIn(effortBodyRef.current, event, 'data-effort-index')
      if (index === null) return
      if (activeEfforts.length === 0) return
      if (keyEvent.key === 'ArrowDown' || keyEvent.key === 'ArrowUp') {
        keyEvent.preventDefault()
        const delta = keyEvent.key === 'ArrowDown' ? 1 : -1
        focusEffort((index + delta + activeEfforts.length) % activeEfforts.length)
        return
      }
      if (keyEvent.key === 'Home' || keyEvent.key === 'End') {
        keyEvent.preventDefault()
        focusEffort(keyEvent.key === 'Home' ? 0 : activeEfforts.length - 1)
        return
      }
      if (keyEvent.key === 'ArrowLeft') {
        keyEvent.preventDefault()
        focusActiveModel()
      }
    }

    const onRootKeyDown = (event: unknown): void => {
      const keyEvent = event as KeyboardLikeEvent
      if (keyEvent.nativeEvent?.isComposing === true) return
      if (!open) return
      if (keyEvent.key === 'Escape') {
        keyEvent.preventDefault()
        keyEvent.stopPropagation()
        if (confirmTeamOff) {
          dismissConfirm()
          return
        }
        if (query !== '') {
          setQuery('')
          return
        }
        close(true)
        return
      }
      if (keyEvent.key !== 'Tab') return
      const panel = panelRef.current
      if (panel === null) return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'))
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (first === undefined || last === undefined) return
      const focused = document.activeElement
      if (focused === triggerRef.current) {
        keyEvent.preventDefault()
        if (keyEvent.shiftKey) {
          last.focus()
        } else if (activeIsCurrent) {
          focusActiveEffort()
        } else {
          focusActiveModel()
        }
        return
      }
      if (focused === first && keyEvent.shiftKey) {
        keyEvent.preventDefault()
        last.focus()
        return
      }
      if (focused === last && !keyEvent.shiftKey) {
        keyEvent.preventDefault()
        focusActiveModel()
      }
    }

    const onBlur = (event: unknown): void => {
      if (!open) return
      if (busy || teamPending) return
      const related = (event as FocusLikeEvent).relatedTarget
      if (related instanceof Node && (
        rootRef.current?.contains(related) === true || panelRef.current?.contains(related) === true
      )) return
      close(false)
    }

    const onPanelMouseDown = (event: unknown): void => {
      const element = targetElement(event)
      if (element !== null && element.closest('input, textarea') !== null) return
      // Keep focus inside the card: a mouse press on a disabled row or an
      // inert header must not blur the panel and close it before the click.
      ;(event as MouseLikeEvent).preventDefault()
    }

    React.useLayoutEffect(() => {
      if (!open) return undefined
      const update = (): void => {
        const trigger = triggerRef.current
        if (trigger === null) return
        const rect = trigger.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const margin = 12
        const width = Math.min(560, Math.max(260, viewportWidth - margin * 2))
        const left = Math.max(margin, Math.min(rect.right - width, viewportWidth - width - margin))
        const spaceAbove = rect.top - margin - 8
        const spaceBelow = viewportHeight - rect.bottom - margin - 8
        const placeBelow = spaceAbove < 220 && spaceBelow > spaceAbove
        const maxHeight = Math.max(200, Math.min(420, placeBelow ? spaceBelow : spaceAbove))
        setPosition((previous) => {
          const top = placeBelow ? rect.bottom + 8 : undefined
          const bottom = placeBelow ? undefined : Math.max(margin, viewportHeight - rect.top + 8)
          if (previous !== null
            && previous.left === left
            && previous.width === width
            && previous.maxHeight === maxHeight
            && previous.top === top
            && previous.bottom === bottom) return previous
          return {
            left,
            width,
            maxHeight,
            ...top === undefined ? {} : { top },
            ...bottom === undefined ? {} : { bottom },
          }
        })
      }
      update()
      window.addEventListener('resize', update)
      window.addEventListener('scroll', update, true)
      return () => {
        window.removeEventListener('resize', update)
        window.removeEventListener('scroll', update, true)
      }
    }, [open])

    React.useEffect(() => {
      if (!open) return undefined
      const onDocumentMouseDown = (event: MouseEvent): void => {
        const target = event.target
        if (target instanceof Node && (
          rootRef.current?.contains(target) === true || panelRef.current?.contains(target) === true
        )) return
        close(false)
      }
      document.addEventListener('mousedown', onDocumentMouseDown)
      return () => { document.removeEventListener('mousedown', onDocumentMouseDown) }
    }, [open])

    React.useEffect(() => () => {
      if (aimTimerRef.current !== null) window.clearTimeout(aimTimerRef.current)
    }, [])

    React.useEffect(() => {
      if (locked && open) close(false)
    }, [locked, open])

    React.useEffect(() => {
      if (confirmTeamOff && !teamEnabled) dismissConfirm()
    }, [confirmTeamOff, teamEnabled])

    React.useLayoutEffect(() => {
      if (confirmTeamOff) confirmCancelRef.current?.focus({ preventScroll: true })
    }, [confirmTeamOff])

    React.useLayoutEffect(() => {
      if (!open || position === null || !focusPendingRef.current || activeEntry === undefined) return
      focusPendingRef.current = false
      // Opening the panel must reveal the saved model even when focus goes to
      // the effort column; a long list otherwise opens scrolled to the top.
      const currentModelRow = modelBodyRef.current?.querySelector<HTMLElement>('[data-model-current]')
        ?? modelBodyRef.current?.querySelector<HTMLElement>('[data-model-active]')
        ?? null
      revealRow(modelBodyRef.current, currentModelRow)
      if (activeIsCurrent) {
        const currentRow = effortBodyRef.current?.querySelector<HTMLElement>('[data-effort-current]')
        if (currentRow) {
          currentRow.focus({ preventScroll: true })
          revealRow(effortBodyRef.current, currentRow)
          return
        }
      }
      if (currentModelRow) {
        currentModelRow.focus({ preventScroll: true })
        revealRow(modelBodyRef.current, currentModelRow)
      }
    }, [open, position, activeEntry, activeIsCurrent])

    if (!available) return null

    const waitingLabel = t('trigger.loading')
    const modelLabel = waiting
      ? waitingLabel
      : currentUnavailable
        ? t('trigger.unavailable')
        : currentInfo?.model.name ?? t('trigger.fallback')
    const triggerText = effortLabel === undefined ? modelLabel : `${modelLabel} · ${effortLabel}`
    const triggerAria = waiting
      ? waitingLabel
      : currentUnavailable
        ? t('trigger.unavailable')
        : currentInfo === undefined
          ? t('trigger.fallback')
          : effortLabel === undefined
            ? t('trigger.aria', { model: modelLabel })
            : t('trigger.ariaEffort', { model: modelLabel, effort: effortLabel })
    const noMatches = showSearch && query.trim() !== ''

    const trigger = h('button', {
      ref: triggerRef,
      type: 'button',
      className: 'fms-trigger',
      'aria-label': triggerAria,
      'aria-haspopup': 'dialog',
      'aria-expanded': open,
      'aria-controls': open ? panelId : undefined,
      'aria-busy': busy || undefined,
      title: triggerText,
      disabled: locked,
      onMouseEnter: prefetch,
      onFocus: prefetch,
      onClick: () => { if (open) close(true); else show() },
    },
    h(TriggerIcon),
    h('span', { className: 'fms-triggerLabel' }, modelLabel),
    effortLabel === undefined ? null : h('span', { className: 'fms-triggerEffort' }, effortLabel),
    busy ? h(Spinner) : h(ChevronIcon, { open }))

    const catalogError = lastActionRef.current === 'load' ? state.error : null
    const modelChildren: unknown[] = []
    if (catalogError !== null && view.entries.length > 0) {
      modelChildren.push(h('div', { className: 'fms-error', role: 'alert', key: 'catalog-error' },
        h('span', null, t('error.action', { message: catalogError })),
        h('button', { type: 'button', className: 'fms-retry', onClick: reload }, t('action.retry'))))
    }
    for (const groupFailure of state.failures) {
      modelChildren.push(h('div', { className: 'fms-warning', role: 'alert', key: `failure:${groupFailure.id}` },
        h('span', null, t('warning.groupLoad', {
          name: groupFailure.id === 'deepseek-account' ? accountName : groupFailure.name,
          message: groupFailure.message,
        })),
        h('button', { type: 'button', className: 'fms-retry', onClick: reload }, t('action.retry'))))
    }
    if (currentUnavailable) {
      modelChildren.push(h('div', { className: 'fms-warning', key: 'current-unavailable', role: 'status' },
        h('span', null, t('warning.currentUnavailable'))))
    }
    if (state.status === 'loading' && view.entries.length > 0 && !noMatches) {
      modelChildren.push(h('div', { className: 'fms-status fms-refreshing', role: 'status', key: 'refreshing' }, t('status.refreshing')))
    }
    if (view.entries.length === 0) {
      if (waiting) {
        modelChildren.push(h('div', { className: 'fms-status', role: 'status', key: 'status' }, t('status.loading')))
      } else if (catalogError !== null) {
        modelChildren.push(h('div', { className: 'fms-error', role: 'alert', key: 'error' },
          h('span', null, t('error.action', { message: catalogError })),
          h('button', { type: 'button', className: 'fms-retry', onClick: reload }, t('action.retry'))))
      } else {
        modelChildren.push(h('div', { className: 'fms-status', key: 'empty' }, noMatches ? t('search.empty') : t('status.emptyModels')))
      }
    } else {
      const activeGroupId = activeEntry?.groupId
      const pendingGroupId = pendingEntry?.groupId
      for (const group of view.groups) {
        modelChildren.push(h(GroupBlock, {
          key: `group:${group.id}`,
          group,
          activeKey: activeGroupId === group.id && activeEntry !== undefined ? activeEntry.key : null,
          currentKey: currentInfo?.group.id === group.id ? currentKey : null,
          pendingKey: pendingGroupId === group.id && pendingKey !== null ? pendingKey : null,
          disabled: busy,
        }))
      }
    }

    const effortChildren: unknown[] = []
    if (waiting) {
      effortChildren.push(h('div', { className: 'fms-status', role: 'status', key: 'status' }, t('status.loading')))
    } else if (activeEntry === undefined) {
      effortChildren.push(h('div', { className: 'fms-status', key: 'empty-model' }, noMatches ? t('search.empty') : t('status.emptyModels')))
    } else {
      activeEfforts.forEach((choice, index) => {
        const selected = activeIsCurrent && choice.effort === activeEffort
        const rowPending = busy && pendingIsActive && choice.effort === pendingEffort
        const selection: Selection = {
          provider: activeEntry.groupId,
          model: activeEntry.model.id,
          ...choice.effort === undefined ? {} : { reasoningEffort: choice.effort },
        }
        const favorite = favoriteKeys.has(favoriteKey(selection))
        const rowName = `${activeEntry.model.name} · ${choice.label}`
        const favoriteLabel = favorite
          ? t('favorite.removeAria', { name: rowName })
          : t('favorite.addAria', { name: rowName })
        effortChildren.push(h('div', {
          key: choice.key,
          className: 'fms-effortItem',
          role: 'presentation',
        },
        h('button', {
          type: 'button',
          role: 'option',
          'aria-selected': selected,
          'data-effort-index': index,
          'data-effort-current': selected ? '' : undefined,
          tabIndex: index === effortTabIndex ? 0 : -1,
          disabled: busy,
          title: choice.description,
          className: classes(
            'fms-option',
            'fms-effortOption',
            selected && 'fms-optionCurrent',
          ),
          onClick: () => { chooseEffort(choice) },
        },
        h('span', { className: 'fms-check', 'aria-hidden': true }, rowPending ? h(Spinner) : selected ? h(CheckIcon) : null),
        h('span', { className: 'fms-name' }, choice.label)),
        h('button', {
          type: 'button',
          className: classes('fms-star', favorite && 'fms-starOn'),
          'aria-pressed': favorite,
          'aria-label': favoriteLabel,
          title: favoriteLabel,
          disabled: busy || !favoritesReady,
          onClick: () => { toggleFavorite(selection) },
        }, h(StarIcon, { filled: favorite }))))
      })
    }

    const searchField = showSearch
      ? h('div', { className: 'fms-searchField' },
          h('input', {
            ref: searchRef,
            type: 'text',
            role: 'searchbox',
            className: 'fms-search',
            placeholder: t('search.placeholder'),
            'aria-label': t('search.placeholder'),
            'aria-controls': modelListId,
            value: query,
            spellCheck: false,
            autoComplete: 'off',
            onChange: onSearchChange,
            onKeyDown: onSearchKeyDown,
          }),
          query === ''
            ? null
            : h('button', {
                type: 'button',
                className: 'fms-searchClear',
                'aria-label': t('search.clear'),
                onClick: () => { clearSearch() },
              }, '\u00d7'))
      : null

    const favoritesArea = h('div', {
      className: 'fms-favorites',
      role: 'group',
      'aria-label': t('favorites.regionAria'),
    },
    h('div', { className: 'fms-favoritesTitle' },
      h('span', null, t('favorites.title')),
      h('span', { className: 'fms-favoritesStar' }, h(StarIcon, { filled: true }))),
    h('div', { className: 'fms-favoritesList' },
      favorites.length === 0
        ? h('div', { className: 'fms-favoritesEmpty' }, t('favorites.emptyHint'))
        : favoriteChips.map(chip => h('div', { className: 'fms-favoriteItem', key: chip.key },
            h('button', {
              type: 'button',
              className: 'fms-favoriteChip',
              disabled: !chip.available || busy,
              title: chip.available ? chip.name : `${chip.name} · ${t('favorite.unavailable')}`,
              'aria-label': chip.available ? chip.name : `${chip.name} · ${t('favorite.unavailable')}`,
              onClick: () => { chooseFavorite(chip) },
            },
            h('span', { className: 'fms-favoriteModel' }, chip.modelName),
            h('span', { className: 'fms-favoriteEffort' }, ' · ' + chip.effortLabel)),
            h('button', {
              type: 'button',
              className: 'fms-favoriteRemove',
              'aria-label': t('favorite.removeAria', { name: chip.name }),
              title: t('favorite.removeAria', { name: chip.name }),
              onClick: () => { toggleFavorite(chip.selection) },
            }, '\u00d7')))))

    const columns = h('div', { className: 'fms-columns' },
      h('section', { className: 'fms-column' },
        h('div', { className: 'fms-columnHeader' },
          h('span', { className: 'fms-headerTitle' }, t('column.model')),
          searchField),
        h('div', {
          ref: modelBodyRef,
          id: modelListId,
          className: 'fms-modelBody',
          role: 'group',
          'aria-label': t('column.model'),
          onMouseLeave: resetHoverAim,
          onFocus: onModelFocus,
          onClick: onModelClick,
          onKeyDown: onModelKeyDown,
        }, modelChildren)),
      h('section', { className: 'fms-column fms-effortColumn' },
        h('div', { className: 'fms-columnHeader' },
          h('span', { className: 'fms-headerTitle' }, t('column.effort')),
          activeEntry === undefined
            ? null
            : h('span', { className: 'fms-effortModel', title: activeEntry.model.name }, activeEntry.model.name)),
        h('div', {
          ref: effortBodyRef,
          className: 'fms-effortBody',
          role: 'listbox',
          'aria-label': activeEntry === undefined
            ? t('column.effort')
            : `${t('column.effort')}: ${activeEntry.model.name}`,
          onKeyDown: onEffortKeyDown,
        }, effortChildren)))

    const failureStrip = failure === null ? null : h('div', {
      className: 'fms-error fms-failure',
      role: 'alert',
    }, h('span', null, failure))

    const confirmTitleId = `${panelId}-team-title`
    const confirmDescId = `${panelId}-team-desc`
    const confirmBlock = h('div', {
      className: 'fms-confirm',
      role: 'alertdialog',
      'aria-modal': 'false',
      'aria-labelledby': confirmTitleId,
      'aria-describedby': confirmDescId,
    },
      h('div', { className: 'fms-confirmTitle', id: confirmTitleId }, t('team.confirmTitle')),
      h('p', { className: 'fms-confirmCopy', id: confirmDescId }, t('team.confirmDescription')),
      h('p', { className: 'fms-confirmCopy fms-confirmWarning' }, t('team.confirmWarning')),
      h('div', { className: 'fms-confirmActions' },
        h('button', {
          ref: confirmCancelRef,
          type: 'button',
          className: 'fms-button',
          disabled: teamPending,
          onClick: () => { dismissConfirm() },
        }, t('team.cancel')),
        h('button', {
          type: 'button',
          className: 'fms-button fms-buttonDanger',
          disabled: teamPending || busy || locked,
          onClick: () => { applyTeam(false) },
        }, t('team.confirm'))))

    const teamRow = h('div', { className: 'fms-teamRow' },
      h('span', { className: 'fms-teamLabel' }, t('team.label')),
      h('button', {
        ref: teamRowRef,
        type: 'button',
        role: 'switch',
        'aria-checked': teamEnabled,
        'aria-busy': teamPending || undefined,
        'aria-label': t('team.label'),
        className: 'fms-switch',
        title: t('team.description'),
        disabled: locked || busy || teamPending,
        onClick: toggleTeam,
      }, h('span', { className: 'fms-switchThumb' })))

    const footer = teamAvailable
      ? h('div', { className: 'fms-footer' }, teamRow, confirmTeamOff ? confirmBlock : null)
      : null

    const panel = h('div', {
      ref: panelRef,
      id: panelId,
      className: 'fms-panel',
      role: 'dialog',
      'aria-label': t('panel.aria'),
      style: position === null ? undefined : {
        left: `${position.left}px`,
        ...position.top === undefined ? {} : { top: `${position.top}px` },
        ...position.bottom === undefined ? {} : { bottom: `${position.bottom}px` },
        width: `${position.width}px`,
        maxHeight: `${position.maxHeight}px`,
      },
      onMouseDown: onPanelMouseDown,
      onMouseMove: onPanelMouseMove,
      onMouseLeave: onPanelMouseLeave,
    }, favoritesArea, columns, failureStrip, footer)

    return h('div', {
      ref: rootRef,
      className: 'fms-root',
      onBlur,
      onKeyDown: onRootKeyDown,
    },
    trigger,
    open && position !== null ? ReactDOM.createPortal(panel, document.body) : null)
  }

  return FastModelSelector
}
