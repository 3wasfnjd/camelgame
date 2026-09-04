import { Vector3 } from "three";
import type { WeatherKind } from "@/game/types";

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export class NeedsSystem {
  health = 100;
  stamina = 100;
  thirst = 86;
  hunger = 88;
  water = 2;
  dates = 4;

  update(dt: number, sprinting: boolean, heat: number) {
    this.thirst = clamp(this.thirst - dt * (.15 + heat * .13 + (sprinting ? .19 : 0)));
    this.hunger = clamp(this.hunger - dt * (.055 + (sprinting ? .035 : 0)));
    this.stamina = clamp(this.stamina + dt * (sprinting ? -15 : 9));
    if (this.thirst <= 0 || this.hunger <= 0) this.health = clamp(this.health - dt * 2.2);
    else if (this.thirst > 35 && this.hunger > 35) this.health = clamp(this.health + dt * .18);
  }

  damage(amount: number) {
    this.health = clamp(this.health - amount);
  }

  collect(type: "water" | "dates") {
    if (type === "water") this.water += 1;
    else this.dates += 2;
  }

  useBestSupply(): string {
    if (this.thirst < 78 && this.water > 0) {
      this.water -= 1;
      this.thirst = clamp(this.thirst + 38);
      return "Water restored thirst";
    }
    if (this.hunger < 82 && this.dates > 0) {
      this.dates -= 1;
      this.hunger = clamp(this.hunger + 24);
      return "Dates restored hunger";
    }
    return this.water + this.dates > 0 ? "No supply needed yet" : "Your satchel is empty";
  }
}

type WeatherPreset = { kind: WeatherKind; label: string; duration: number; wind: number; heat: number };
const WEATHER: WeatherPreset[] = [
  { kind: "clear", label: "Clear skies", duration: 48, wind: .18, heat: .65 },
  { kind: "windy", label: "Desert wind", duration: 32, wind: .5, heat: .55 },
  { kind: "sandstorm", label: "Sandstorm", duration: 22, wind: 1, heat: .25 },
  { kind: "clear", label: "Clear skies", duration: 55, wind: .16, heat: .75 },
];

export class WeatherSystem {
  private index = 0;
  private elapsed = 0;
  current = WEATHER[0];

  update(dt: number): boolean {
    this.elapsed += dt;
    if (this.elapsed < this.current.duration) return false;
    this.elapsed = 0;
    this.index = (this.index + 1) % WEATHER.length;
    this.current = WEATHER[this.index];
    return true;
  }
}

export class DayNightSystem {
  hour = 16.5;

  update(dt: number) {
    this.hour = (this.hour + dt * .045) % 24;
  }

  get formatted() {
    const hours = Math.floor(this.hour);
    const minutes = Math.floor((this.hour - hours) * 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  get daylight() {
    return Math.max(0, Math.sin(((this.hour - 6) / 12) * Math.PI));
  }
}

type Mission = { title: string; detail: string; target: Vector3; arrival: string };
const MISSIONS: Mission[] = [
  { title: "Reach the Moonwell Oasis", detail: "Follow the turquoise beacon and find fresh water.", target: new Vector3(35, 0, -28), arrival: "Moonwell discovered — saddle blanket unlocked" },
  { title: "Read the Sunstone Ruins", detail: "Cross the high dunes and seek the ancient stone arch.", target: new Vector3(-48, 0, 42), arrival: "The Sunstone inscription reveals an old caravan route" },
  { title: "Return to Ember Camp", detail: "Carry the discovered route back to the desert camp.", target: new Vector3(48, 0, 35), arrival: "Trail complete — Sahra is now a Wayfinder" },
];

export class MissionSystem {
  stage = 0;
  level = 1;

  get current(): Mission | null {
    return MISSIONS[this.stage] ?? null;
  }

  update(position: Vector3): string | null {
    const mission = this.current;
    if (!mission || position.distanceTo(mission.target) > 7) return null;
    this.stage += 1;
    this.level = Math.min(4, this.level + 1);
    return mission.arrival;
  }

  get distanceMeters() {
    return (position: Vector3) => this.current ? Math.round(position.distanceTo(this.current.target) * 18) : 0;
  }
}
