/**
 * Theme-token CSS for the fast model selector. It is injected once by the
 * Client plugin through ctx.effect and removed on unload; the panel surface
 * follows the host menu material (--dsw-specific-menu + backdrop filter).
 */
export const CSS = `
.fms-root {
  position: relative;
  min-width: 0;
  font-family: var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
}

/* Composer chip: shape and responsive behavior copied from the host model
   seat so the composer's row measurement keeps working unchanged. */
.fms-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 360px;
  height: 28px;
  padding: 0 4px 0 8px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-family: inherit;
  font-size: 13px;
  line-height: 20px;
  font-weight: 400;
  cursor: pointer;
}

@media (hover: hover) {
  .fms-trigger:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}

.fms-trigger:focus-visible {
  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
}

.fms-trigger:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

.fms-triggerLabel {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fms-triggerEffort {
  flex-shrink: 1000;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-caption);
}

.fms-triggerIcon {
  display: var(--dsh-composer-model-icon-display, none);
  flex: 0 0 auto;
}

.fms-triggerLabel,
.fms-triggerEffort {
  display: var(--dsh-composer-model-text-display, block);
}

.fms-chevron {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-caption);
  transition: transform 120ms ease;
}

.fms-chevronOpen {
  transform: rotate(180deg);
}

.fms-spinner {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--dsw-alias-border-l3);
  border-top-color: var(--dsw-alias-label-secondary);
  border-radius: 50%;
  animation: fms-spin 800ms linear infinite;
}

@keyframes fms-spin {
  to { transform: rotate(360deg); }
}

/* Portaled two-column card. Fixed coordinates come from the trigger rect;
   max-height/width are clamped by the component before render. */
.fms-panel {
  position: fixed;
  z-index: 1100;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 4px;
  overflow: hidden;
  border: 0;
  border-radius: var(--dsw-radius-lg);
  box-shadow: var(--dsw-elevation-prominent);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}

.fms-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--dsw-specific-menu, var(--dsw-alias-bg-base));
  backdrop-filter: var(--dsw-menu-backdrop-filter, none);
  pointer-events: none;
}

.fms-searchRow {
  flex: none;
  padding: 2px 4px 4px;
}

.fms-searchField {
  position: relative;
}

.fms-search {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 30px;
  padding: 0 30px 0 9px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md);
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 12px;
  line-height: 18px;
}

.fms-search::placeholder {
  color: var(--dsw-alias-label-caption);
}

.fms-search:focus {
  border-color: var(--dsw-alias-state-business-primary);
}

.fms-searchClear {
  position: absolute;
  top: 50%;
  right: 8px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  transform: translateY(-50%);
  border: none;
  border-radius: 50%;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.fms-searchClear:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover);
}

@media (hover: hover) {
  .fms-searchClear:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}

.fms-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.fms-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.fms-effortColumn {
  /* The model list's always-visible scrollbar is the column divider. */
}

.fms-columnHeader {
  display: flex;
  flex: none;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  height: 40px;
  padding: 4px 8px 2px;
  box-sizing: border-box;
}

.fms-headerTitle {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fms-effortModel {
  flex: none;
  min-width: 0;
  padding: 0 8px 6px;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  text-decoration: underline;
  text-underline-offset: 4px;
  white-space: nowrap;
}

.fms-modelBody,
.fms-effortBody {
  flex: 1 1 auto;
  min-height: 0;
  padding: 2px;
  overflow-x: hidden;
  overflow-y: auto;
}

/* The model list keeps its scrollbar rail visible even when the catalog fits,
   so the rail doubles as the divider between the two columns. */
.fms-modelBody {
  overflow-y: scroll;
}

.fms-modelBody::-webkit-scrollbar-track {
  background: linear-gradient(
    to right,
    transparent 0,
    transparent calc(100% - 1px),
    var(--dsw-alias-border-l2) calc(100% - 1px),
    var(--dsw-alias-border-l2) 100%
  );
}

@supports not selector(::-webkit-scrollbar) {
  /* Firefox has no stylable track; keep the divider on the column instead. */
  .fms-modelBody {
    border-right: 1px solid var(--dsw-alias-border-l2);
  }
}

.fms-group {
  display: block;
}

.fms-groupHeader {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 28px;
  padding: 6px 8px 2px;
  background: var(--dsw-specific-menu, var(--dsw-alias-bg-base));
  backdrop-filter: var(--dsw-menu-backdrop-filter, none);
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0.04em;
}

.fms-groupHeader > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fms-groupHeader::after {
  content: '';
  flex: 1 1 auto;
  height: 0.5px;
  background: var(--dsw-alias-border-l1);
}

.fms-groupHeader:first-child {
  padding-top: 2px;
}

.fms-option {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  padding: 5px 7px;
  border: none;
  border-radius: var(--dsw-radius-md);
  outline: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  content-visibility: auto;
  contain-intrinsic-size: auto 34px;
}

.fms-optionActive:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.fms-modelOption {
  max-width: 100%;
}

/* Menu-aim may leave keyboard focus on a row that is no longer the active
   one; keep that focus visible with the host focus-ring token. */
.fms-modelOption:focus-visible {
  box-shadow: inset 0 0 0 1.5px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
}

.fms-effortOption:focus-visible { background: var(--dsw-alias-interactive-bg-hover); }

@media (hover: hover) {
  .fms-effortOption:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}

.fms-option:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

.fms-optionCurrent .fms-name {
  font-weight: 600;
}

.fms-check {
  display: grid;
  place-items: center;
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  color: var(--dsw-alias-label-primary);
}

.fms-check svg {
  width: 14px;
  height: 14px;
}

.fms-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fms-badge {
  flex: 0 0 auto;
  max-width: 110px;
  padding: 0 5px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  font-weight: 500;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fms-optionChevron {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  color: var(--dsw-alias-label-caption);
}

.fms-status {
  padding: 10px 8px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}

.fms-refreshing {
  padding: 4px 8px;
  font-size: 11px;
}

.fms-error,
.fms-warning {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 2px 0;
  padding: 6px 7px;
  border-radius: var(--dsw-radius-md);
  font-size: 11px;
  line-height: 16px;
}

.fms-error {
  background: var(--dsw-alias-interactive-bg-hover-danger);
  color: var(--dsw-alias-state-error-primary);
}

.fms-warning {
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-state-warn-label);
}

.fms-error > span,
.fms-warning > span {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

.fms-retry {
  flex: 0 0 auto;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.fms-failure {
  flex: none;
  margin: 4px 4px 0;
}

.fms-footer {
  flex: none;
  margin-top: 2px;
  padding: 4px 8px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}

.fms-teamRow {
  box-sizing: border-box;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-height: 34px;
  padding: 0 8px;
  border-radius: var(--dsw-radius-md);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
}

.fms-teamRow:has(.fms-switch:focus-visible) {
  background: var(--dsw-alias-interactive-bg-hover);
}

@media (hover: hover) {
  .fms-teamRow:has(.fms-switch:not(:disabled)):hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}

.fms-teamLabel {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* DSH Switch primitive dimensions/colors: the button is the track, and its
   ::after extends the hit target over the whole row (ui-primitives Switch +
   TeamModeToggle). static positioning lets ::after resolve against the row. */
.fms-switch {
  box-sizing: border-box;
  position: static;
  flex: 0 0 auto;
  width: 36px;
  height: 20px;
  padding: 2px;
  border: 0;
  border-radius: 999px;
  corner-shape: round;
  background: var(--dsw-alias-border-l3);
  cursor: pointer;
}

.fms-switch[aria-checked='true'] {
  background: var(--dsw-alias-brand-primary);
}

.fms-switch:disabled {
  cursor: default;
  opacity: 0.5;
}

.fms-switch:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}

.fms-switch::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--dsw-radius-md);
}

.fms-switchThumb {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  corner-shape: round;
  background: var(--dsw-alias-label-primary-foreground, #ffffff);
  transition: transform 0.12s ease;
}

.fms-switch[aria-checked='false'] .fms-switchThumb {
  background: var(--dsw-alias-switch-thumb);
}

.fms-switch[aria-checked='true'] .fms-switchThumb {
  transform: translateX(16px);
}

.fms-confirm {
  margin-top: 4px;
  padding: 8px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
}

.fms-confirmTitle {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.fms-confirmCopy {
  margin: 4px 0 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}

.fms-confirmWarning {
  color: var(--dsw-alias-state-warn-label);
}

.fms-confirmActions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.fms-button {
  height: 28px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.fms-button:focus-visible { box-shadow: 0 0 0 2px var(--dsw-alias-state-business-primary); }

@media (hover: hover) {
  .fms-button:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}

.fms-buttonDanger {
  border-color: var(--dsw-alias-state-error-primary);
  color: var(--dsw-alias-state-error-primary);
}

@media (hover: hover) {
  .fms-buttonDanger:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover-danger);
  }
}

.fms-button:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

@media (prefers-reduced-motion: reduce) {
  .fms-chevron,
  .fms-switch,
  .fms-switchThumb {
    transition: none;
  }

  .fms-spinner {
    animation-duration: 2s;
  }
}
`
