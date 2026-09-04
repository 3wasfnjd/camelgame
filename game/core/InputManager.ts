import type { InputFrame, MobileControls } from "@/game/types";

export class InputManager {
  private keys = new Set<string>();
  private mobile: MobileControls = { forward: 0, turn: 0, sprint: false, jump: false };
  private previousJump = false;
  private previousUse = false;
  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "shift", "control", " ", "e", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
    }
    this.keys.add(key);
  };
  private onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.key.toLowerCase());
  private onBlur = () => this.keys.clear();

  constructor() {
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  setMobileControl(name: keyof MobileControls, value: number | boolean) {
    Object.assign(this.mobile, { [name]: value });
  }

  sample(): InputFrame {
    const forwardKeys = (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0) - (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0);
    const turnKeys = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) - (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);
    const jump = this.keys.has(" ") || this.mobile.jump;
    const use = this.keys.has("e");
    const frame: InputFrame = {
      forward: Math.max(-1, Math.min(1, Math.abs(this.mobile.forward) > .08 ? this.mobile.forward : forwardKeys)),
      turn: Math.max(-1, Math.min(1, Math.abs(this.mobile.turn) > .08 ? this.mobile.turn : turnKeys)),
      sprint: this.keys.has("shift") || this.mobile.sprint,
      walk: this.keys.has("control"),
      jumpPressed: jump && !this.previousJump,
      usePressed: use && !this.previousUse,
    };
    this.previousJump = jump;
    this.previousUse = use;
    return frame;
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }
}
