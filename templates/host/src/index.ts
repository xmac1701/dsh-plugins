import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

/** Loader row name. Keep it unique across the whole profile. */
export const name = '__PACKAGE__'

/**
 * Services that must be ready before `apply()` runs. Add a key such as
 * 'tools' only when the plugin really consumes that service.
 */
export const inject: string[] = []

/** Row configuration, validated by the Loader before `apply()` runs. */
export const Config = Schema.object({
  message: Schema.string().default('Hello from __PACKAGE__'),
})

type Config = { message: string }

/**
 * Called once when the Loader activates this row. Register every resource
 * with `ctx.effect`, `ctx.on`, or the owning service: Cordis disposes them
 * together when the plugin unloads.
 */
export function apply(ctx: Context, config: Config) {
  ctx.logger('__PACKAGE__').info(config.message)
}
