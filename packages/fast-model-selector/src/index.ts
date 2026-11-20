/**
 * Host half of the fast model selector: declares the favorites setting so the
 * DSH settings provider persists it in the profile, and hides the generated
 * settings page because the selector owns that UI.
 *
 * The client reads/writes `favorites` through the existing `settings` Remote
 * namespace; the namespace id is the bundle row id in cordis.patch.yml.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

/** One saved model + reasoning-effort pair. */
export interface FavoriteSelection {
  provider: string
  model: string
  reasoningEffort?: string
}

/** Host config persisted in the profile's plugin config. */
export interface Config {
  favorites?: FavoriteSelection[]
}

/** Volatile config field: the settings provider can write it live. */
export const Config = z.object({
  favorites: z.array(z.object({
    provider: z.string().required(),
    model: z.string().required(),
    reasoningEffort: z.string(),
  })).default([]).volatile(),
})

/** Minimal settings-service face used to hide the automatic settings page. */
interface SettingsFace {
  configure(presentation: { auto?: boolean }, owner: unknown): () => void
}

/**
 * Register the settings presentation policy. The Host row lives in the bundle
 * patch; `auto: false` keeps the favorites field out of the Settings UI while
 * still making it readable/writable through `ctx.remote.settings`.
 * @param ctx - Host context owning the plugin row.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (scope) => {
    const settings = (scope as unknown as { settings: SettingsFace }).settings
    scope.effect(
      () => settings.configure({ auto: false }, ctx.fiber),
      'fast-model-selector: hide generated settings page',
    )
  })
}
