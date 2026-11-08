---
version: alpha
name: SahaPul
description: A field operations observatory for environmental sensor networks.
colors:
  primary: '#126d68'
  background: '#edf3f6'
  surface: '#ffffff'
  text: '#153746'
  muted: '#526977'
  border: '#d5e1e7'
  warning: '#94600e'
  danger: '#b13838'
typography:
  body:
    fontFamily: 'Segoe UI, Tahoma, sans-serif'
  display:
    fontFamily: 'Bahnschrift, Trebuchet MS, Segoe UI, sans-serif'
  data:
    fontFamily: 'Consolas, Courier New, monospace'
rounded:
  DEFAULT: '10px'
  control: '6px'
spacing:
  panel: '22px'
  page: '34px'
components:
  panel:
    rounded: '10px'
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
  button:
    rounded: '6px'
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
  caption:
    textColor: '{colors.muted}'
    backgroundColor: '{colors.surface}'
  warning:
    textColor: '{colors.warning}'
    backgroundColor: '{colors.surface}'
  error:
    textColor: '{colors.danger}'
    backgroundColor: '{colors.surface}'
  divider:
    backgroundColor: '{colors.border}'
---

# SahaPul design system

## Overview

Product register: a field operations workstation, inspired by hydrographic survey instruments. The audience monitors environmental changes and station health on desktop and mobile. The current brief specifies English and no market-specific localization. Dates/numbers use the browser locale and timezone, explicitly identified in Settings.

The signature is a quiet station ledger: a dark ocean-blue navigation rail beside a pale blue-gray observation surface, with monospace readings and a teal instrument trace. Avoid marketing heroes, decorative KPIs, glow effects and fabricated measurement trends. Familiar controls take priority over visual novelty.

## Colors

The canonical runtime source is `web/src/index.css` (`:root`). This file mirrors its accepted values. `colors.primary` maps to `--accent`, background to `--plane`, surface to `--surface`, text to `--ink`, muted to `--muted`, border to `--line`, warning to `--warning`, danger to `--critical`. Tailwind is an adapter using these CSS variables; charts and the map consume the variables directly. Labels accompany severity and health colors. Light theme is deliberate; reduced motion and forced colors follow system preferences.

## Typography

`typography.body`, display and data map to `--font-body`, `--font-display`, `--font-data`. System-installed font stacks avoid network/font-loading dependencies on Windows. Display type appears only in headings and brand, monospace in measurements, timestamps and captions. Main heading is 34px, section heading 16px, body 15px; secondary metadata is smaller. Long identifiers wrap in details; tables scroll horizontally.

## Layout

Desktop: 230px navigation rail, a 1600px maximum workspace and a main chart/map column with a 330px station/activity column. At 1000px, the main content becomes one column; at 700px, navigation becomes horizontally scrollable and summary cells become two columns. Page padding decreases from 34px to 16px. Document owns vertical scrolling; only data tables and navigation may scroll internally. Forms retain natural height.

## Elevation & Depth

White panels and borders separate content without shadows. The selected navigation item uses a single inset marker. Keep chart and map controls legible above third-party layers. No modal overlays are currently used.

## Shapes

`--radius` is 10px for panels; controls are 6px. Badges are small rectangles with explicit status text. Line weight is 1px for structure and 3px for focused controls. No ornamental icon tiles.

## Components

Button styles, input/select fields, badges, loading indicators, scrollbar and panels have canonical owners in global CSS. `AsyncState` owns loading/error/empty/retry presentation. `NodeList`, `MetricChart`, `MapView`, and `AlertManager` own their repeated domain behavior. Focus uses a visible 3px teal outline. Buttons retain enabled/disabled and pressed/busy semantics; forms use inline validation with first-error focus. Native select menus deliberately accept platform-owned geometry and keyboard behavior. No date picker is introduced. DeviceInventory owns name/ID search with an explicit clear button, health/condition filters and URL query persistence. Buttons and metric selectors have a 44px minimum target height. Custom navigation SVGs share a 1.6px stroke; tabular figures align measurements.

Global scrollbars use standards-based color/width plus WebKit thumb/track/hover/active fallbacks; forced colors restore system colors. Selected metric buttons use `aria-pressed`. Table headers are semantic and the wide history table has a named keyboard-focusable scroll region.

## Do's and Don'ts

Use observed backend values; show — for missing measurements. Explain disconnected, loading and empty states. Keep acknowledgment separate from sensor recovery. Preserve map, station and chart interactions. Do not imply simulated stations are physical hardware. Do not draw lines across missing sensor values. Do not suppress an error by replacing its content with a successful empty response.
