export type GameSnapshot = {
  health: number;
  stamina: number;
  thirst: number;
  hunger: number;
  water: number;
  dates: number;
  time: string;
  weather: string;
  location: string;
  objective: string;
  objectiveDetail: string;
  objectiveDistance: number;
  level: number;
  toast: string;
};

export type MobileControls = {
  forward: number;
  turn: number;
  sprint: boolean;
  jump: boolean;
};

export type InputFrame = {
  forward: number;
  turn: number;
  sprint: boolean;
  walk: boolean;
  jumpPressed: boolean;
  usePressed: boolean;
};

export type WeatherKind = "clear" | "windy" | "sandstorm";
