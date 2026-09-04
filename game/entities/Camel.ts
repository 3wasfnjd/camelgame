import * as THREE from "three";
import type { InputFrame } from "@/game/types";

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function material(color: number, roughness = .82) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: .02 });
}

function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material) {
  const item = new THREE.Mesh(geometry, mat);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function cylinderBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material) {
  const direction = b.clone().sub(a);
  const item = mesh(new THREE.CylinderGeometry(radius * .84, radius, direction.length(), 9), mat);
  item.position.copy(a).add(b).multiplyScalar(.5);
  item.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
  return item;
}

export class Camel {
  readonly group = new THREE.Group();
  private visual = new THREE.Group();
  private legs: THREE.Group[] = [];
  private saddle: THREE.Mesh;
  private speed = 0;
  private verticalVelocity = 0;
  private grounded = true;
  private gaitTime = 0;
  private travelSinceStep = 0;
  private footprintReady = false;
  private footprintSide = 1;
  yaw = 0;
  sprinting = false;

  constructor(private readonly terrainHeight: (x: number, z: number) => number) {
    const fur = material(0xc9864b);
    const lightFur = material(0xe0aa6d);
    const dark = material(0x3a2318);
    const leather = material(0x633223);
    const cloth = material(0xa8382f);
    const gold = material(0xd9a444, .5);

    this.group.add(this.visual);

    const body = mesh(new THREE.SphereGeometry(1, 18, 13), fur);
    body.scale.set(1.08, .86, 1.72);
    body.position.set(0, 2.12, 0);
    this.visual.add(body);

    const chest = mesh(new THREE.SphereGeometry(.73, 14, 10), lightFur);
    chest.scale.set(.92, 1.02, 1.08);
    chest.position.set(0, 2.38, 1.13);
    this.visual.add(chest);

    const hump = mesh(new THREE.SphereGeometry(.77, 14, 10), fur);
    hump.scale.set(.86, 1.22, .98);
    hump.position.set(0, 3.08, -.22);
    hump.rotation.x = -.15;
    this.visual.add(hump);

    this.visual.add(cylinderBetween(new THREE.Vector3(0, 2.72, 1.15), new THREE.Vector3(0, 4.15, 2.05), .44, lightFur));

    const head = mesh(new THREE.SphereGeometry(.52, 16, 12), lightFur);
    head.scale.set(.82, .92, 1.18);
    head.position.set(0, 4.35, 2.35);
    head.rotation.x = -.12;
    this.visual.add(head);

    const muzzle = mesh(new THREE.SphereGeometry(.36, 14, 10), material(0xd9a06c));
    muzzle.scale.set(1.05, .65, 1.25);
    muzzle.position.set(0, 4.15, 2.9);
    this.visual.add(muzzle);

    for (const side of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(.14, .44, 8), fur);
      ear.position.set(side * .37, 4.8, 2.15);
      ear.rotation.z = side * -.55;
      this.visual.add(ear);

      const eye = mesh(new THREE.SphereGeometry(.075, 10, 8), dark);
      eye.position.set(side * .38, 4.48, 2.64);
      this.visual.add(eye);
    }

    const bridle = mesh(new THREE.TorusGeometry(.43, .035, 8, 24), leather);
    bridle.rotation.y = Math.PI / 2;
    bridle.position.set(0, 4.27, 2.55);
    this.visual.add(bridle);

    this.saddle = mesh(new THREE.BoxGeometry(1.55, .16, 1.62), cloth);
    this.saddle.position.set(0, 3.04, -.18);
    this.saddle.rotation.x = -.06;
    this.visual.add(this.saddle);

    const saddleTop = mesh(new THREE.BoxGeometry(1.1, .24, .78), leather);
    saddleTop.position.set(0, 3.22, -.18);
    this.visual.add(saddleTop);

    for (const side of [-1, 1]) {
      const pack = mesh(new THREE.SphereGeometry(.42, 10, 8), leather);
      pack.scale.set(.55, .8, 1.15);
      pack.position.set(side * .88, 2.85, -.42);
      this.visual.add(pack);
      const clasp = mesh(new THREE.CylinderGeometry(.07, .07, .08, 10), gold);
      clasp.rotation.z = Math.PI / 2;
      clasp.position.set(side * 1.11, 2.9, -.42);
      this.visual.add(clasp);
    }

    const legPositions: Array<[number, number]> = [[-.63, .84], [.63, .84], [-.63, -.82], [.63, -.82]];
    legPositions.forEach(([x, z], index) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.92, z);
      const upper = mesh(new THREE.CylinderGeometry(.16, .22, 1.08, 9), fur);
      upper.position.y = -.53;
      pivot.add(upper);
      const lower = mesh(new THREE.CylinderGeometry(.11, .14, .92, 9), lightFur);
      lower.position.set(0, -1.48, .04);
      pivot.add(lower);
      const hoof = mesh(new THREE.SphereGeometry(.2, 9, 7), dark);
      hoof.scale.set(1.15, .48, 1.45);
      hoof.position.set(0, -1.95, .15);
      pivot.add(hoof);
      pivot.userData.phase = index % 2 === 0 ? 0 : Math.PI;
      this.legs.push(pivot);
      this.visual.add(pivot);
    });

    const tail = cylinderBetween(new THREE.Vector3(0, 2.35, -1.48), new THREE.Vector3(0, 1.55, -1.92), .08, dark);
    this.visual.add(tail);

    this.group.position.set(0, this.terrainHeight(0, -5), -5);
    this.group.rotation.y = this.yaw;
  }

  update(dt: number, input: InputFrame, canSprint: boolean) {
    const moving = Math.abs(input.forward) > .05;
    const isSprinting = moving && input.forward > 0 && input.sprint && canSprint;
    const desiredSpeed = !moving ? 0 : input.forward * (isSprinting ? 7.8 : input.walk ? 2.3 : 4.6);
    this.speed += (desiredSpeed - this.speed) * Math.min(1, dt * 4.5);
    this.sprinting = isSprinting && Math.abs(this.speed) > 5.3;

    const turnStrength = .85 + Math.min(1, Math.abs(this.speed) / 3) * .65;
    this.yaw -= input.turn * turnStrength * dt;
    this.group.rotation.y = this.yaw;

    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const distance = this.speed * dt;
    const nextX = this.group.position.x + forward.x * distance;
    const nextZ = this.group.position.z + forward.z * distance;
    const currentGround = this.terrainHeight(this.group.position.x, this.group.position.z);
    const nextGround = this.terrainHeight(nextX, nextZ);
    const climb = nextGround - currentGround;
    const slopeSlow = Math.max(.38, 1 - Math.max(0, climb / Math.max(.05, Math.abs(distance))) * .5);

    if (Math.abs(nextX) < 101 && Math.abs(nextZ) < 101) {
      this.group.position.x += forward.x * distance * slopeSlow;
      this.group.position.z += forward.z * distance * slopeSlow;
    }

    if (input.jumpPressed && this.grounded) {
      this.verticalVelocity = 6.8;
      this.grounded = false;
    }

    const ground = this.terrainHeight(this.group.position.x, this.group.position.z);
    if (!this.grounded) {
      this.verticalVelocity -= 18 * dt;
      this.group.position.y += this.verticalVelocity * dt;
      if (this.group.position.y <= ground) {
        this.group.position.y = ground;
        this.verticalVelocity = 0;
        this.grounded = true;
      }
    } else {
      this.group.position.y += (ground - this.group.position.y) * Math.min(1, dt * 12);
    }

    const speedRatio = Math.min(1, Math.abs(this.speed) / 6.5);
    this.gaitTime += dt * (2.2 + speedRatio * 5.5);
    this.legs.forEach((leg) => {
      leg.rotation.x = Math.sin(this.gaitTime + Number(leg.userData.phase)) * .58 * speedRatio;
    });
    this.visual.position.y = Math.sin(this.gaitTime * 2) * .06 * speedRatio;
    this.visual.rotation.z += ((-input.turn * .09 * speedRatio) - this.visual.rotation.z) * Math.min(1, dt * 6);
    this.visual.rotation.x += ((Math.atan2(climb, Math.max(.2, Math.abs(distance))) * .2) - this.visual.rotation.x) * Math.min(1, dt * 4);

    this.travelSinceStep += Math.abs(distance);
    if (this.grounded && speedRatio > .22 && this.travelSinceStep > .82) {
      this.travelSinceStep = 0;
      this.footprintReady = true;
      this.footprintSide *= -1;
    }

    return { moving, sprinting: this.sprinting };
  }

  animateIdle(dt: number, time: number) {
    this.visual.position.y += (Math.sin(time * 1.4) * .025 - this.visual.position.y) * Math.min(1, dt * 3);
    this.visual.rotation.z *= Math.max(0, 1 - dt * 4);
  }

  consumeFootprint(): THREE.Vector3 | null {
    if (!this.footprintReady) return null;
    this.footprintReady = false;
    const side = new THREE.Vector3(this.footprintSide * .38, .025, -.78).applyAxisAngle(Y_AXIS, this.yaw);
    return this.group.position.clone().add(side);
  }

  unlockSaddle() {
    (this.saddle.material as THREE.MeshStandardMaterial).color.setHex(0x2b8b84);
    (this.saddle.material as THREE.MeshStandardMaterial).emissive.setHex(0x0b2827);
  }

  get position() {
    return this.group.position;
  }

  dispose() {
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((item) => item.dispose());
    });
  }
}
