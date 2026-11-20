English | [简体中文](README.zh-CN.md)

# Fast Model Selector

A DSH Web UI plugin that picks "model + reasoning effort" in a single two-column panel. It replaces the native model selector in the composer (the model chip at the composer's bottom right) while keeping the agent teamwork toggle at the bottom of the panel.

## Features

- **Two-column panel**: the left column lists models grouped by provider; the right column shows the reasoning efforts for the currently highlighted model.
- **Single click to choose**: hovering, focusing, or tapping a model only switches the right-hand list; clicking a reasoning effort commits the full model and reasoning effort, avoiding the step-by-step "pick a model, then pick an effort" menu.
- **Favorites**: the top of the panel shows favorite entries as "model + reasoning effort", and clicking one switches directly. While hovering the reasoning list, a five-star button appears at the right of each row; gold means it is favorited.
- **Favorite persistence**: favorites are written to the profile's plugin configuration (the `favorites` field of `fast-model-selector`) through the DSH settings Remote, not to browser localStorage; by design, no UI is generated on the Settings page.
- **Deferred writes**: favoriting and unfavoriting inside the panel only change in-memory state. Settings are written all at once when the panel closes (and when the page is hidden or the component unmounts), so every favorite change does not fire a DSH settings event that refreshes the model list.
- **Menu-aim**: when the mouse moves diagonally from the current model row toward the reasoning list, other model rows passed over do not steal the highlight. The switch happens only after the pointer stops or changes direction for about 200ms, so you can slide diagonally straight into the reasoning column instead of moving horizontally first and then vertically.
- **Current selection visible**: the current model and current reasoning effort are bold, with a check mark on the left.
- **Clear correspondence**: the highlighted model row and the reasoning effort hover share the same background color; both list containers use the same transparent background, and the model list's permanent scrollbar acts as the column divider; each model row ends with a chevron pointing to the right column; the search box is merged into the "Model" header row (borderless, right-aligned, 64px normally, auto-expanding on focus), and the currently highlighted model name is merged into the "Reasoning effort" header row (right-aligned, width-limited, underlined).
- **Search**: when there are more than 4 models in total, a search box appears under the "Model" header in the model column, filtering by model name or provider name; ↑/↓ moves into the results, Enter jumps to the reasoning column, and Escape first clears the search.
- **Performance**: the model catalog is not loaded for this plugin on first paint; the shared catalog's idempotent `load()` is called only on the first hover, focus, or trigger open. Model and provider indexes are built only after the panel opens; model rows are memo components, reasoning efforts are computed only for the currently highlighted model; off-screen rows use `content-visibility: auto`, and provider headers are sticky.
- **Automatic sync**: reads the shared store of `ctx.modelDirectories` and updates with the catalog refresh after model configuration, credentials, or the default model is changed on the settings page; switching through the `/model` command also syncs here. When the saved model is removed, the trigger shows "Current model unavailable" and the panel prompts you to select again.
- **Agent teamwork**: the "Enable agent teamwork" toggle is kept at the bottom and is available to the root session; when it is disabled and the session has already used a model, a confirmation area expands inline.

## Installation

In DSH's **Plugins → Add plugin**, select this directory, or install it from the plugin marketplace and then enable it:

```sh
pnpm install
pnpm build
```

The package is installed into the profile and enabled as a bundle. Refresh the page after installation; disabling the bundle restores the native model selector.

## Interaction

- When the panel opens, the current model and current reasoning effort are in the selected state.
- Hovering a model or focusing it with the keyboard switches the right-hand list to that model's efforts.
- When the mouse moves diagonally toward the reasoning column, menu-aim ignores the model rows passed over; the switch happens only after stopping on a row or changing direction.
- The favorites area is pinned at the top of the panel: it shows a hint when there are no favorites, and lays entries out horizontally when there are some; clicking an entry switches directly, and the × on the right of an entry removes it. While hovering the reasoning list, all star buttons appear, and a lit gold star means favorited.
- Clicking a reasoning effort switches the model and effort and closes the panel; if the clicked combination is the current one, only the panel closes.
- When a model has no reasoning effort metadata, the right column provides a single `Default` row and no `reasoningEffort` is written on submit; the trigger and the right column both display Default in that case.
- When there are more than 4 models, a search box appears in the sub-header row below the model column header; it matches model names or provider names.
- Keyboard: in the model column, ↑/↓/Home/End move, and →/Enter enter the reasoning column; in the reasoning column, ↑/↓ move, and ← returns to the model column; Escape closes; Tab cycles within the panel.

## Performance notes

- The client script is prefetched through `dsh.client.immediately`, avoiding the flash of the native chip appearing on first paint and then being replaced; the script is very small.
- Model catalog data is loaded asynchronously once at client startup by the `ModelDirectoryResolver` of the DSH base plugin `ui-model-selection` (the native `/model` command also depends on it). This plugin reuses that shared data, makes no duplicate requests, and does no extra derivation or rendering at startup.
- Reasoning efforts are computed on demand (only for the currently highlighted model); no arrays are pre-built for all models in the catalog.
- Model, provider, and lookup tables are built only after the panel opens; while the panel is closed, only one lightweight lookup for the current route is done, and no arrays are built for the whole catalog at startup.
- Model rows and effort rows have fixed height and ellipsized text, use `content-visibility: auto` to skip off-screen painting, and provider headers are sticky; the whole DOM unmounts when the panel closes.
- Search appears only when there are more than 4 models; filtering happens while the panel is open and does not change the trigger's current selection.
- This version targets dozens to hundreds of models; if the catalog reaches thousands, the model column can be changed to a windowed list later.

## Compatibility and limitations

- Depends on the `ctx.modelDirectories`, `modelSelection`, and `agentTeam` projection interfaces of the DSH `0.2.2-rc.5` series (`engines.dsh` restricted to `<0.3.0`).
- As with the native behavior, an addressed sub-agent session does not show the model seat; the teamwork toggle is not shown for listed sub-sessions.
- The `/model` command still uses the native dialog and is not replaced; both entry points share the same session selection state.
- This plugin shadows the native seat with slot priority `-2`. Do not enable other plugins that also replace `conversation.input.model` at the same time (for example, `dsh-2d-model-picker` uses `-1`); registrations at the same priority trigger a slot conflict.
- While shadowed, the native `conversation.input.model.options` sub-slot is not rendered, so rows that other plugins add to that sub-slot will not appear; the teamwork toggle is re-implemented in place by this plugin.
- The search threshold matches the native one (more than 4 models); filtering matches only model names and provider names, with no pinyin or word segmentation.
- Client copy is currently available in Chinese and English; other DSH UI languages fall back to English and may be mixed with the host interface.
- Third-party decoration sub-slots of the native `conversation.input.model.label` are not rendered; the model badge is displayed in a neutral style rather than the provider-specified tone.
- Favorites are stored in the plugin configuration of the current DSH profile and are preserved across browsers and clients that share the same profile; they are not synced automatically across profiles or devices.
- Deferred writes mean that if the page crashes before the panel closes, the last uncommitted favorite change may be lost; a save failure shows a hint in the favorites area and is retried the next time the panel closes.
- If the settings service is not mounted in the profile, favorites only take effect in the current session's memory, and load or save failures are reported inside the panel.
- The Settings page does not show this configuration item (host-side `settings.configure({ auto: false })`); the configuration can still be read and written through the DSH settings Remote.

## Development

```sh
pnpm --filter dsh-plugin-fast-model-selector typecheck
pnpm --filter dsh-plugin-fast-model-selector build
pnpm check
```

`src/client.ts` is the browser entry, `src/seat.ts` is the two-column selector component, `src/theme.ts` is the theme token styles, and `src/locales.ts` is the client copy. The host half, `src/index.ts`, is empty.
