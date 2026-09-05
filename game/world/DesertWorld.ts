import * as THREE from "three";
import type { WeatherKind } from "@/game/types";

type Pickup = { group: THREE.Group; type: "water" | "dates"; active: boolean; baseY: number };
type Footprint = { mesh: THREE.Mesh; age: number };
type Jackal = { group: THREE.Group; center: THREE.Vector3; phase: number; radius: number };

const LANDMARKS = {
  oasis: new THREE.Vector3(35, 0, -28),
  ruins: new THREE.Vector3(-48, 0, 42),
  camp: new THREE.Vector3(48, 0, 35),
  village: new THREE.Vector3(-45, 0, -35),
};

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function terrainHeight(x: number, z: number) {
  const broad = Math.sin(x * .045) * 2.4 + Math.cos(z * .052) * 2.05;
  const crossed = Math.sin((x + z) * .076) * 1.25 + Math.cos((x - z) * .061) * .9;
  const ripples = Math.sin(x * .16 + Math.cos(z * .09) * 2) * .35;
  let height = broad + crossed + ripples - .8;
  const flats: Array<[number, number, number, number]> = [
    [35, -28, 12, -1.15], [-48, 42, 11, .4], [48, 35, 10, .15], [-45, -35, 10, .3], [0, -5, 8, 0],
  ];
  for (const [cx, cz, radius, target] of flats) {
    const distance = Math.hypot(x - cx, z - cz);
    if (distance < radius) height = THREE.MathUtils.lerp(target, height, smoothstep(radius * .45, radius, distance));
  }
  return height;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function standard(color: number, roughness = .9, emissive = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: .01, emissive });
}

function makeMesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
  const item = new THREE.Mesh(geometry, material);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

export class DesertWorld {
  readonly group = new THREE.Group();
  private dust: THREE.Points;
  private dustPositions: THREE.BufferAttribute;
  private beacon = new THREE.Group();
  private beaconBeam: THREE.Mesh;
  private pickups: Pickup[] = [];
  private footprints: Footprint[] = [];
  private jackals: Jackal[] = [];
  private waterSurface?: THREE.Mesh;
  private weather: WeatherKind = "clear";
  private elapsed = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.scene.add(this.group);
    this.createTerrain();
    this.createOasis();
    this.createRuins();
    this.createCamp();
    this.createVillage();
    this.scatterEnvironment();
    this.createPickups();
    this.createJackals();
    const dust = this.createDust();
    this.dust = dust.points;
    this.dustPositions = dust.positions;
    this.group.add(this.dust);
    this.beaconBeam = this.createBeacon();
  }

  private createTerrain() {
    const geometry = new THREE.PlaneGeometry(220, 220, 96, 96);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const low = new THREE.Color(0xc88743);
    const high = new THREE.Color(0xf1c574);
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const z = position.getZ(index);
      const y = terrainHeight(x, z);
      position.setY(index, y);
      const tone = THREE.MathUtils.clamp((y + 5) / 11, 0, 1);
      const color = low.clone().lerp(high, tone * .8 + Math.sin(x * .2) * .03);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    const terrain = makeMesh(geometry, material);
    terrain.receiveShadow = true;
    terrain.castShadow = false;
    this.group.add(terrain);

    const rimMaterial = standard(0x80502e);
    const random = seededRandom(94);
    for (let i = 0; i < 34; i += 1) {
      const angle = (i / 34) * Math.PI * 2;
      const radius = 104 + random() * 7;
      const mountain = makeMesh(new THREE.ConeGeometry(5 + random() * 5, 12 + random() * 14, 5), rimMaterial);
      mountain.position.set(Math.cos(angle) * radius, 2.5, Math.sin(angle) * radius);
      mountain.rotation.y = random() * Math.PI;
      mountain.scale.z = .7 + random() * .9;
      this.group.add(mountain);
    }
  }

  private createOasis() {
    const { x, z } = LANDMARKS.oasis;
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2d9eab, roughness: .25, metalness: .05, transparent: true, opacity: .82, emissive: 0x063238 });
    const water = makeMesh(new THREE.CylinderGeometry(6.5, 7.2, .11, 30), waterMat);
    water.position.set(x, terrainHeight(x, z) + .08, z);
    water.receiveShadow = false;
    this.waterSurface = water;
    this.group.add(water);

    [[-6, -2], [5, -4], [6, 3], [-4, 5], [1, 6]].forEach(([dx, dz], index) => {
      this.createPalm(x + dx, z + dz, .8 + (index % 3) * .12);
    });

    const grassMat = standard(0x71984f);
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2;
      const radius = 6.4 + (i % 4) * .34;
      const tuft = makeMesh(new THREE.ConeGeometry(.22, .8, 5), grassMat);
      const px = x + Math.cos(angle) * radius;
      const pz = z + Math.sin(angle) * radius;
      tuft.position.set(px, terrainHeight(px, pz) + .38, pz);
      tuft.rotation.z = Math.sin(angle) * .2;
      this.group.add(tuft);
    }
  }

  private createPalm(x: number, z: number, scale: number) {
    const palm = new THREE.Group();
    const trunkMat = standard(0x70442a);
    for (let i = 0; i < 5; i += 1) {
      const segment = makeMesh(new THREE.CylinderGeometry(.19 - i * .018, .27 - i * .018, .95, 7), trunkMat);
      segment.position.y = .45 + i * .82;
      segment.rotation.z = .035 * i;
      palm.add(segment);
    }
    const leafMat = standard(0x2f7048);
    for (let i = 0; i < 8; i += 1) {
      const leaf = makeMesh(new THREE.ConeGeometry(.34, 3.1, 5), leafMat);
      leaf.position.y = 4.55;
      leaf.rotation.z = Math.PI / 2.8;
      leaf.rotation.y = (i / 8) * Math.PI * 2;
      leaf.translateY(1.05);
      palm.add(leaf);
    }
    palm.scale.setScalar(scale);
    palm.position.set(x, terrainHeight(x, z), z);
    this.group.add(palm);
  }

  private createRuins() {
    const { x, z } = LANDMARKS.ruins;
    const stone = standard(0xb77b4b);
    const darkStone = standard(0x7d4d34);
    for (const dx of [-3.2, 3.2]) {
      const pillar = makeMesh(new THREE.BoxGeometry(1.25, 6.5, 1.25), stone);
      pillar.position.set(x + dx, terrainHeight(x + dx, z) + 3.25, z);
      pillar.rotation.y = dx * .015;
      this.group.add(pillar);
      const capital = makeMesh(new THREE.BoxGeometry(1.8, .55, 1.65), darkStone);
      capital.position.set(x + dx, terrainHeight(x + dx, z) + 6.55, z);
      this.group.add(capital);
    }
    const lintel = makeMesh(new THREE.BoxGeometry(8.1, 1.15, 1.5), stone);
    lintel.position.set(x, terrainHeight(x, z) + 7.05, z);
    lintel.rotation.z = -.025;
    this.group.add(lintel);

    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const px = x + Math.cos(angle) * (7 + i % 3);
      const pz = z + Math.sin(angle) * (7 + i % 2);
      const block = makeMesh(new THREE.BoxGeometry(1.8 + (i % 2), .8 + (i % 3) * .45, 1.3), i % 2 ? stone : darkStone);
      block.position.set(px, terrainHeight(px, pz) + .45, pz);
      block.rotation.set(i * .05, angle, i * .08);
      this.group.add(block);
    }
  }

  private createCamp() {
    const { x, z } = LANDMARKS.camp;
    const tentMat = standard(0x7b3130);
    const stripeMat = standard(0xd4a35a);
    [[0, 0], [-5, 3], [4.5, 4]].forEach(([dx, dz], index) => {
      const tent = makeMesh(new THREE.ConeGeometry(2.6, 2.4, 4), index === 1 ? stripeMat : tentMat);
      const px = x + dx;
      const pz = z + dz;
      tent.position.set(px, terrainHeight(px, pz) + 1.2, pz);
      tent.rotation.y = Math.PI / 4 + index * .25;
      tent.scale.z = 1.35;
      this.group.add(tent);
    });
    const fire = makeMesh(new THREE.ConeGeometry(.45, 1.1, 7), new THREE.MeshStandardMaterial({ color: 0xff8738, emissive: 0xb9320a, emissiveIntensity: 2 }));
    fire.position.set(x + 1.5, terrainHeight(x + 1.5, z - 2.5) + .55, z - 2.5);
    this.group.add(fire);
    const fireLight = new THREE.PointLight(0xff813d, 3.2, 17, 2);
    fireLight.position.copy(fire.position).add(new THREE.Vector3(0, 1.2, 0));
    this.group.add(fireLight);
  }

  private createVillage() {
    const { x, z } = LANDMARKS.village;
    const adobe = standard(0xb96f3e);
    const shade = standard(0x68402d);
    [[0,0], [4,1], [-4,2], [2,-4], [-3,-4]].forEach(([dx, dz], index) => {
      const px = x + dx;
      const pz = z + dz;
      const hut = makeMesh(new THREE.BoxGeometry(3, 2.3 + (index % 2) * .6, 3), adobe);
      hut.position.set(px, terrainHeight(px, pz) + 1.15, pz);
      hut.rotation.y = index * .18;
      this.group.add(hut);
      const door = makeMesh(new THREE.BoxGeometry(.85, 1.45, .08), shade);
      door.position.set(px, terrainHeight(px, pz) + .73, pz + 1.52);
      this.group.add(door);
    });
  }

  private scatterEnvironment() {
    const random = seededRandom(2026);
    const rockMat = standard(0x8f5738);
    const shrubMat = standard(0x697342);
    for (let i = 0; i < 110; i += 1) {
      const x = random() * 194 - 97;
      const z = random() * 194 - 97;
      if (Object.values(LANDMARKS).some((point) => Math.hypot(x - point.x, z - point.z) < 12) || Math.hypot(x, z + 5) < 6) continue;
      if (random() > .38) {
        const size = .3 + random() * 1.2;
        const rock = makeMesh(new THREE.DodecahedronGeometry(size, 0), rockMat);
        rock.scale.set(1.2, .6 + random() * .7, .8);
        rock.position.set(x, terrainHeight(x, z) + size * .42, z);
        rock.rotation.set(random(), random() * Math.PI, random());
        this.group.add(rock);
      } else {
        const shrub = new THREE.Group();
        for (let stem = 0; stem < 4; stem += 1) {
          const branch = makeMesh(new THREE.ConeGeometry(.09, .8 + random() * .5, 5), shrubMat);
          branch.rotation.z = (stem - 1.5) * .28;
          shrub.add(branch);
        }
        shrub.position.set(x, terrainHeight(x, z) + .35, z);
        shrub.rotation.y = random() * Math.PI;
        shrub.scale.setScalar(.6 + random() * .8);
        this.group.add(shrub);
      }
    }
  }

  private createPickups() {
    const placements: Array<[number, number, "water" | "dates"]> = [
      [27, -20, "water"], [40, -37, "water"], [-20, 22, "dates"], [-38, 34, "dates"], [39, 28, "dates"], [-31, -31, "water"],
    ];
    placements.forEach(([x, z, type]) => {
      const group = new THREE.Group();
      const color = type === "water" ? 0x5ddfea : 0xe29a3b;
      const orb = makeMesh(new THREE.IcosahedronGeometry(.38, 1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .7, roughness: .25 }));
      const ring = makeMesh(new THREE.TorusGeometry(.63, .035, 7, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .65 }));
      ring.rotation.x = Math.PI / 2;
      group.add(orb, ring);
      const baseY = terrainHeight(x, z) + 1.1;
      group.position.set(x, baseY, z);
      this.pickups.push({ group, type, active: true, baseY });
      this.group.add(group);
    });
  }

  private createJackals() {
    const fur = standard(0x6d4933);
    const placements: Array<[number, number, number]> = [[-10, 34, 6], [18, 42, 8], [-30, -5, 5]];
    placements.forEach(([x, z, radius], index) => {
      const animal = new THREE.Group();
      const body = makeMesh(new THREE.SphereGeometry(.48, 9, 7), fur);
      body.scale.set(.7, .75, 1.35);
      body.position.y = .72;
      animal.add(body);
      const head = makeMesh(new THREE.ConeGeometry(.34, .9, 6), fur);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, .95, .8);
      animal.add(head);
      const tail = makeMesh(new THREE.ConeGeometry(.12, 1, 6), fur);
      tail.rotation.x = -Math.PI / 2.8;
      tail.position.set(0, .85, -.85);
      animal.add(tail);
      this.jackals.push({ group: animal, center: new THREE.Vector3(x, 0, z), phase: index * 2.1, radius });
      this.group.add(animal);
    });
  }

  private createDust() {
    const count = 650;
    const positions = new Float32Array(count * 3);
    const random = seededRandom(818);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = random() * 70 - 35;
      positions[i * 3 + 1] = random() * 9 + .2;
      positions[i * 3 + 2] = random() * 70 - 35;
    }
    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3);
    geometry.setAttribute("position", attribute);
    const dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xf3ce8b, size: .12, transparent: true, opacity: .18, depthWrite: false }));
    return { points: dust, positions: attribute };
  }

  private createBeacon() {
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x64e0ce, transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending });
    const beam = makeMesh(new THREE.CylinderGeometry(.18, 1.35, 17, 16, 1, true), beamMat);
    beam.position.y = 8.5;
    const ring = makeMesh(new THREE.TorusGeometry(1.5, .06, 8, 40), new THREE.MeshBasicMaterial({ color: 0x8df3dc, transparent: true, opacity: .75 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .16;
    this.beacon.add(beam, ring);
    this.group.add(this.beacon);
    return beam;
  }

  setBeacon(target: THREE.Vector3 | null) {
    this.beacon.visible = Boolean(target);
    if (!target) return;
    this.beacon.position.set(target.x, terrainHeight(target.x, target.z), target.z);
  }

  setWeather(kind: WeatherKind) {
    this.weather = kind;
    const material = this.dust.material as THREE.PointsMaterial;
    material.opacity = kind === "sandstorm" ? .68 : kind === "windy" ? .32 : .16;
    material.size = kind === "sandstorm" ? .22 : .11;
  }

  update(dt: number, player: THREE.Vector3, wind: number) {
    this.elapsed += dt;
    this.dust.position.set(player.x, 0, player.z);
    const array = this.dustPositions.array as Float32Array;
    for (let i = 0; i < this.dustPositions.count; i += 1) {
      const xIndex = i * 3;
      array[xIndex] += dt * (1.8 + wind * 9) * (1 + (i % 7) * .04);
      array[xIndex + 2] += dt * wind * 1.8;
      if (array[xIndex] > 35) array[xIndex] = -35;
      if (array[xIndex + 2] > 35) array[xIndex + 2] = -35;
    }
    this.dustPositions.needsUpdate = true;

    if (this.waterSurface) {
      this.waterSurface.scale.y = 1 + Math.sin(this.elapsed * 1.6) * .05;
      (this.waterSurface.material as THREE.MeshStandardMaterial).emissiveIntensity = .5 + Math.sin(this.elapsed) * .1;
    }
    this.beacon.rotation.y += dt * .45;
    (this.beaconBeam.material as THREE.MeshBasicMaterial).opacity = .13 + Math.sin(this.elapsed * 1.4) * .035;

    this.pickups.forEach((pickup, index) => {
      if (!pickup.active) return;
      pickup.group.rotation.y += dt * .9;
      pickup.group.position.y = pickup.baseY + Math.sin(this.elapsed * 2 + index) * .2;
    });

    let danger = false;
    this.jackals.forEach((jackal, index) => {
      const angle = this.elapsed * (.22 + index * .025) + jackal.phase;
      const x = jackal.center.x + Math.cos(angle) * jackal.radius;
      const z = jackal.center.z + Math.sin(angle) * jackal.radius;
      jackal.group.position.set(x, terrainHeight(x, z), z);
      jackal.group.rotation.y = -angle;
      jackal.group.position.y += Math.abs(Math.sin(this.elapsed * 5 + index)) * .08;
      if (jackal.group.position.distanceTo(player) < 2.3) danger = true;
    });

    this.footprints = this.footprints.filter((footprint) => {
      footprint.age += dt;
      const material = footprint.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, .26 * (1 - footprint.age / 11));
      if (footprint.age <= 11) return true;
      this.group.remove(footprint.mesh);
      footprint.mesh.geometry.dispose();
      material.dispose();
      return false;
    });

    return danger;
  }

  collectNearby(player: THREE.Vector3): "water" | "dates" | null {
    for (const pickup of this.pickups) {
      if (!pickup.active || pickup.group.position.distanceTo(player) > 1.8) continue;
      pickup.active = false;
      pickup.group.visible = false;
      return pickup.type;
    }
    return null;
  }

  addFootprint(position: THREE.Vector3, yaw: number) {
    const material = new THREE.MeshBasicMaterial({ color: 0x6f4429, transparent: true, opacity: .26, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const print = new THREE.Mesh(new THREE.CircleGeometry(.21, 12), material);
    print.scale.set(.7, 1.5, 1);
    print.rotation.x = -Math.PI / 2;
    print.rotation.z = -yaw;
    print.position.copy(position);
    print.position.y = terrainHeight(position.x, position.z) + .035;
    this.footprints.push({ mesh: print, age: 0 });
    this.group.add(print);
    if (this.footprints.length > 56) this.footprints[0].age = 99;
  }

  locationAt(position: THREE.Vector3) {
    if (position.distanceTo(LANDMARKS.oasis) < 12) return "واحة بئر القمر";
    if (position.distanceTo(LANDMARKS.ruins) < 14) return "أطلال حجر الشمس";
    if (position.distanceTo(LANDMARKS.camp) < 12) return "مخيم الجمر";
    if (position.distanceTo(LANDMARKS.village) < 12) return "قرية الزعفران";
    if (position.y > 3) return "الكثبان العالية";
    return "كثبان العنبر";
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((item) => item.dispose());
      }
    });
  }
}

export { LANDMARKS };
