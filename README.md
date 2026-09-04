# Desert Camel

A stylized third-person 3D desert exploration game built with React, Three.js, TypeScript, and Vinext.

Play as **Sahra**, an oasis-seeking camel. Cross dunes, discover landmarks, collect supplies, manage survival needs, and follow the old caravan trail.

## Current gameplay

- Third-person camel movement with walking, running, sprinting, jumping, dune climbing, and animated gait
- Large procedural desert with dunes, rocks, vegetation, an oasis, village, camp, mountains, and ancient ruins
- Health, stamina, thirst, and hunger systems
- Water and date pickups with usable supplies
- Three-stage mission trail with landmark beacons and a cosmetic saddle unlock
- Dynamic day/night cycle, wind, sandstorms, atmospheric lighting, moving dust, and fading footprints
- Roaming wild jackals that can damage the player
- Responsive HUD and dedicated touch controls for mobile devices
- Keyboard controls for desktop browsers

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move and steer | `W A S D` or arrow keys | Virtual joystick |
| Walk slowly | Hold `Ctrl` | Light joystick input |
| Sprint | Hold `Shift` | Sprint button |
| Jump | `Space` | Jump button |
| Use water or food | `E` | Pause menu supply button |
| Pause | `P` or `Escape` | Pause button |

## Run locally

Requirements: Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Project structure

```text
app/                         Page entry point, metadata, and HUD styling
components/game/             React game shell and touch interface
game/Game.ts                 Main render loop and system coordination
game/core/InputManager.ts    Keyboard and mobile input abstraction
game/entities/Camel.ts       Camel model, locomotion, gait, and cosmetics
game/world/DesertWorld.ts    Terrain, landmarks, wildlife, pickups, and effects
game/systems/GameSystems.ts  Needs, missions, weather, and time-of-day systems
game/types.ts                Shared game contracts
public/                      Static public assets
```

The systems are separated so more locations, missions, animals, models, and survival mechanics can be added without rewriting the core loop.

## Technology

- React 19
- Three.js
- TypeScript
- Vinext / Vite
- Cloudflare-compatible production output

## Status

This repository contains the complete playable prototype. The current camel and environments are procedural low-poly models; production-quality Blender models, skeletal animation clips, audio, save data, and a larger content pipeline are natural next steps.
