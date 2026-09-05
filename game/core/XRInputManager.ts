import type { XRControls } from "@/game/types";

type XRInputSourceLike = {
  handedness: string;
  gamepad?: Gamepad;
};

type XRSessionLike = {
  inputSources: Iterable<XRInputSourceLike>;
};

const idle: XRControls = { forward: 0, turn: 0, sprint: false, jump: false, use: false };

function strongest(current: number, candidate: number) {
  return Math.abs(candidate) > Math.abs(current) ? candidate : current;
}

export class XRInputManager {
  sample(session: XRSessionLike | null): XRControls {
    if (!session) return { ...idle };

    let forward = 0;
    let turn = 0;
    let sprint = false;
    let jump = false;
    let use = false;

    for (const source of session.inputSources) {
      const gamepad = source.gamepad;
      if (!gamepad) continue;
      const stickX = gamepad.axes.length >= 4 ? gamepad.axes[2] : gamepad.axes[0] ?? 0;
      const stickY = gamepad.axes.length >= 4 ? gamepad.axes[3] : gamepad.axes[1] ?? 0;

      if (source.handedness === "left") {
        forward = strongest(forward, -stickY);
        if (Math.abs(turn) < .08) turn = stickX;
      } else if (source.handedness === "right") {
        turn = strongest(turn, stickX);
      } else {
        forward = strongest(forward, -stickY);
        turn = strongest(turn, stickX);
      }

      sprint ||= Boolean(gamepad.buttons[1]?.pressed);
      jump ||= Boolean(gamepad.buttons[4]?.pressed);
      use ||= Boolean(gamepad.buttons[0]?.pressed);
    }

    return { forward, turn, sprint, jump, use };
  }
}
