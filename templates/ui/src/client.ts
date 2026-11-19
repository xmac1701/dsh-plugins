/**
 * Browser half of the bundle. DSH fetches this file for the page, so it must
 * run as a plain script: register one lazy factory whose id equals the package
 * name, and keep the factory free of side effects.
 *
 * The real slot contract lives in `@deepseek-ai/dsh-client-ui-conversation`;
 * this template declares only the small surface it uses, so the package does
 * not need the client type graph just to compile.
 */

type ReactElementLike = unknown

interface ReactLike {
  createElement(
    type: unknown,
    props?: Record<string, unknown> | null,
    ...children: ReactElementLike[]
  ): ReactElementLike
}

interface ClientContext {
  slots: {
    /** Run `effect` while the slot exists; Cordis disposes it on unload. */
    inject(slot: string, effect: () => void): void
    register(
      options: { name: string; id: string; order?: number },
      component: () => ReactElementLike,
    ): void
  }
}

interface ClientModule {
  id: string
  factory(require: (id: string) => unknown): {
    inject?: string[]
    apply(ctx: ClientContext): void
  }
}

const moduleLoader = (
  globalThis as unknown as { __ModuleLoader__: { load(module: ClientModule): void } }
).__ModuleLoader__

moduleLoader.load({
  id: '__PACKAGE__',
  factory(require) {
    const React = require('react') as ReactLike

    // Placeholder drawing: replace it with the UI this plugin should render.
    function Decoration() {
      return React.createElement(
        'svg',
        {
          viewBox: '0 0 64 64',
          width: 28,
          height: 28,
          'aria-hidden': true,
          style: { display: 'block', pointerEvents: 'none' },
        },
        React.createElement('circle', { cx: 32, cy: 32, r: 24, fill: '#1f8a8a' }),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            { name: 'conversation.composer.dock', id: '__NAME__', order: 5 },
            Decoration,
          ),
        )
      },
    }
  },
})
