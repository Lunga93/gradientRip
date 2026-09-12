## Designer brief — GradientRip

GradientRip is a city route planner for electric skateboards and other personal mobility devices. Its core question is:

> “Can my board safely handle this route, its hills, battery demand, and braking limits?”

The app serves both young recreational riders and delivery drivers. It should feel exciting and energetic, but safety states must always be unmistakable.

The canonical visual direction is **Electric Arcade**: a city map with glowing routes, neon-edged floating panels, power-meter-style progress, and verdicts that feel like a level-up screen. The two themes are:

- **Midday** — light, high-contrast, readable in sunlight
- **Nightride** — dark, neon, city-night energy

Use the existing `DESIGN_SPEC.md` and `design/01–10.png` references. Onboarding is already correct. Treat the other screens as placeholders and redesign them against the specification rather than extending the current implementation.

---

## Complete application flow

### 1. First launch / onboarding

The user chooses what they ride:

- E-skate
- E-bike
- E-scooter
- EUC
- Push-skate
- Pedal-bike
- Kick-scooter

Electric modes use the violet family. Human-powered modes use blue. The user can accept defaults or configure the machine, then continue into the map.

### 2. Main map shell

The app opens on a full-screen city map. A floating panel sits over it:

- Desktop: fixed side panel, approximately 420px wide
- Mobile: bottom sheet with collapsed, half-open, and expanded states

The shell contains:

- Wordmark
- Plan / Saved / Ride navigation
- Theme switch
- Online/offline indicator
- Legal note
- Map controls
- Active session toolbar when needed

### 3. Plan tab

The user builds a route using a visual stop chain:

1. Origin
2. Optional waypoints
3. Destination

Each stop supports:

- Autocomplete
- Saved places
- Use my location
- Add stop
- Remove waypoint
- Reverse order
- Reorder stops

The user then selects:

- Transport mode
- Board/powertrain preset
- Battery, climb, braking, and weight configuration where applicable

The primary action is **Plan route**.

The panel should also offer:

- **Draw a route** — trace a custom route directly on the map
- **Record live** — record the actual ridden path

### 4. Planning process

The flow is:

`Plan form → geocode stops → route each leg → fetch elevation → calculate energy and gradients → generate verdict → render route`

During this process, show a clear loading state or route skeleton. The route should then appear on the map with colored segments showing terrain difficulty.

### 5. Answer / verdict screen

This is the most important screen in the product.

The verdict must be the first thing the user sees:

- **YOU’RE GONNA FLY**
- **GO**
- **WATCH IT**
- **STOP**

Do not collapse “fly” into “go”; it is a distinct reward state.

Below the verdict, show:

- Distance
- Total climb
- Energy used or human effort
- Percentage of usable battery
- Battery ring around the mode icon
- Elevation profile
- Gradient legend
- Save trip
- Start ride

A stop verdict must feel like a hard safety interruption. It should use a strong red state and an initial flash, with reduced-motion support.

### 6. Ride / live tracking

After starting a ride, the map becomes the main surface:

- Planned route ahead is dashed violet
- Traveled route becomes solid cyan
- Rider position is a pulsing cyan dot
- GPS accuracy halo is visible
- Progress, remaining distance, elapsed time, and accuracy are shown
- Upcoming hill or braking warnings appear as floating alerts

The rider can pause, recenter, stop tracking, or finish the ride. Arrival should produce a clear summary state.

### 7. Draw-a-route flow

The user enters draw mode and taps points on the map:

1. Tap points to trace the route
2. See nodes and connecting line
3. Undo or clear points
4. Finish
5. Route snaps to roads where possible
6. Elevation is fetched
7. Route is scored and saved

The map should temporarily take over the screen while drawing.

### 8. Record-live flow

The user records their actual ride:

1. Start recording
2. GPS trace appears in cyan
3. Distance, time, speed, and battery delta update
4. Caution or stop warnings appear immediately
5. Stop recording
6. Name the route
7. Score the recorded route
8. Save it for replay

### 9. Saved tab

Saved trips are available offline and include:

- Planned routes
- Drawn routes
- Recorded rides
- Route thumbnail or preview
- Origin and destination
- Mode
- Distance
- Date
- Cached verdict
- Delete action
- Replay action

Saved places such as Home, Work, Gym, and current location should be available as quick chips while planning.

### 10. Persistent app behavior

The interface must also support:

- Midday / Nightride theme switching
- Online and offline states
- Offline trip replay
- Legal information one tap away
- Reduced motion
- Keyboard focus states
- Large touch targets
- Mobile safe-area insets

Future screens should be designed to extend naturally into route choices, flatter-route alternatives, battery-first planning, multi-drop delivery runs, driver mode, profile/garage, weather warnings, hazard notes, replay, and notifications.

---

## Component responsibilities

| Component | What it does |
|---|---|
| `MapCanvas` | Full-screen Leaflet map and all map layers |
| `+page.svelte` | Main application shell connecting map, onboarding, panel, toolbar, and tabs |
| `PanelHeader` | Wordmark, connection status, theme switch, and panel identity |
| `TabBar` | Switches between Plan, Saved, and Ride |
| `PlanView` | Main planning form and entry point for plan, draw, and record flows |
| `StopList` | Origin, waypoint, and destination chain with autocomplete and stop actions |
| `AddressFocus` | Shows saved-place suggestions while a stop is focused |
| `PresetChips` | Quick access to saved locations |
| `ModePicker` | Seven-mode selector with electric/human visual distinction |
| `BoardChip` | Board or powertrain preset selection |
| `ResultsPanel` | Verdict, stats, battery, elevation profile, and ride controls |
| `RideView` | Ride/result destination after planning or opening a saved trip |
| `SavedView` | Saved-trip library and offline replay entry |
| `SavedTrips` | Individual saved route rows and actions |
| `MapFabs` | Map actions such as location, recenter, layers, draw, and record |
| `SessionToolbar` | Controls for drawing, recording, and active ride sessions |
| `OnboardingModal` | First-launch machine selection and configuration |
| `LegalNote` | Always-visible legal trigger and legal information modal |

The important design relationship is:

`MapCanvas + floating panel + tabs + session toolbar`

The map is always the spatial context. The panel is the control and answer surface. During drawing, recording, or active navigation, the map and session HUD become more prominent.

---

## Three example design directions to show

Please show **three complete design directions**, not just three color variations. Each direction should cover the same core flow: onboarding, plan, answer, live ride, record, and saved trips.

### Direction 1 — Electric Arcade

This should follow the canonical specification most closely:

- Dark Nightride map-first experience
- Violet route line with cyan live trace
- Glowing panel border that changes with verdict
- Large arcade-style verdict takeover
- Animated gradient borders and route drawing
- Neon map markers and power-meter stats
- Strong “level-up” moment when a route is scored

This is the recommended baseline.

### Direction 2 — Midday Dispatch

A driver-first light theme:

- Very high contrast in direct sunlight
- Larger stats and simpler hierarchy
- Map remains important but panels feel more utilitarian
- Clear route and hazard states without heavy glow
- Dense but readable delivery-oriented information
- Strong emphasis on battery budget, climb, braking, and route reliability

This direction should feel trustworthy, fast, and operational.

### Direction 3 — Adaptive Street HUD

A balanced hybrid direction:

- Map-first on mobile, panel-first on desktop
- Calm surfaces with selective Electric Arcade accents
- Verdict controls the color and emphasis of the whole screen
- Route line and elevation profile are the visual heroes
- Minimal chrome and maximum thumb reach
- The same system adapts cleanly between Midday and Nightride

This direction should feel modern, premium, and less game-like while retaining the brand’s energy.

---

## Screens and states to include

For each direction, please show at least:

1. Mobile onboarding
2. Mobile plan panel
3. Mobile route answer
4. Mobile live tracking
5. Mobile recording HUD
6. Saved trips
7. Desktop plan/answer composition
8. Go, Watch It, Stop, and Fly verdict states
9. Loading, empty, error, online, and offline states
10. Midday and Nightride theme examples

Please preserve the required color meanings:

- Violet: brand and electric modes
- Cyan: primary actions and live route
- Amber: caution
- Rose/red: stop and braking danger
- Blue: human-powered modes and informational states

Critical information must never be hidden behind extra taps. The verdict, distance, climb, energy/battery, and dangerous descent information should be immediately legible.