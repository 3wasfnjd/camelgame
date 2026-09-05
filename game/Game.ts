import * as THREE from "three";
import { InputManager } from "@/game/core/InputManager";
import { Camel } from "@/game/entities/Camel";
import { DayNightSystem, MissionSystem, NeedsSystem, WeatherSystem } from "@/game/systems/GameSystems";
import { DesertWorld, terrainHeight } from "@/game/world/DesertWorld";
import type { GameSnapshot, MobileControls } from "@/game/types";

const UP = new THREE.Vector3(0, 1, 0);

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, .1, 380);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly input = new InputManager();
  private readonly world = new DesertWorld(this.scene);
  private readonly camel = new Camel(terrainHeight);
  private readonly needs = new NeedsSystem();
  private readonly weather = new WeatherSystem();
  private readonly day = new DayNightSystem();
  private readonly missions = new MissionSystem();
  private readonly hemisphere = new THREE.HemisphereLight(0xffd89a, 0x50331f, 1.7);
  private readonly sun = new THREE.DirectionalLight(0xffd49b, 2.25);
  private readonly sunDisk: THREE.Mesh;
  private readonly stars: THREE.Points;
  private readonly resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private lastTime = performance.now();
  private started = false;
  private paused = false;
  private disposed = false;
  private uiElapsed = 0;
  private toastText = "";
  private toastRemaining = 0;
  private dangerCooldown = 0;
  private firstFrame = true;

  constructor(
    private readonly mount: HTMLDivElement,
    private readonly onUpdate: (snapshot: GameSnapshot) => void,
  ) {
    if (!window.WebGLRenderingContext) throw new Error("تقنية WebGL غير متاحة");
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute("aria-label", "صحراء ثلاثية الأبعاد قابلة للعب");
    this.mount.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2(0xd69a59, .0065);
    this.scene.add(this.hemisphere);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1536, 1536);
    this.sun.shadow.camera.left = -35;
    this.sun.shadow.camera.right = 35;
    this.sun.shadow.camera.top = 35;
    this.sun.shadow.camera.bottom = -35;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 150;
    this.sun.shadow.bias = -.0008;
    this.scene.add(this.sun, this.sun.target);

    this.sunDisk = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xffd57e, fog: false }),
    );
    this.scene.add(this.sunDisk);
    this.stars = this.createStars();
    this.scene.add(this.stars);

    this.scene.add(this.camel.group);
    this.world.setBeacon(this.missions.current?.target ?? null);
    this.world.setWeather(this.weather.current.kind);

    this.camera.position.set(0, 5, -14);
    this.camera.lookAt(0, 2, 0);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.mount);
    this.resize();
    this.applyAtmosphere();
    this.emitSnapshot();
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  private createStars() {
    const count = 280;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const angle = (i * 2.399963) % (Math.PI * 2);
      const radius = 110 + (i % 17) * 1.7;
      const height = 28 + ((i * 29) % 65);
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xfff0c7, size: .55, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  }

  start() {
    this.started = true;
    this.paused = false;
    this.showToast("بدأت الرحلة — ابحث عن الشعاع الفيروزي");
  }

  setPaused(value: boolean) {
    this.paused = value;
    this.lastTime = performance.now();
  }

  setMobileControl(name: keyof MobileControls, value: number | boolean) {
    this.input.setMobileControl(name, value);
  }

  useSupply() {
    this.showToast(this.needs.useBestSupply());
    this.emitSnapshot();
  }

  private loop = (time: number) => {
    if (this.disposed) return;
    const dt = Math.min(.04, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;

    if (!this.paused) {
      if (this.started) this.update(dt);
      else {
        this.camel.animateIdle(dt, time / 1000);
        this.world.update(dt, this.camel.position, this.weather.current.wind);
        this.updateCamera(dt);
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.firstFrame = false;
    this.animationFrame = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    const input = this.input.sample();
    if (input.usePressed) this.useSupply();

    const motion = this.camel.update(dt, input, this.needs.stamina > 4);
    this.needs.update(dt, motion.sprinting, this.weather.current.heat);
    this.day.update(dt);

    if (this.weather.update(dt)) {
      this.world.setWeather(this.weather.current.kind);
      this.showToast(this.weather.current.kind === "sandstorm" ? "عاصفة رملية تقترب — مستوى الرؤية ينخفض" : `${this.weather.current.label} فوق الكثبان`);
    }

    const inDanger = this.world.update(dt, this.camel.position, this.weather.current.wind);
    this.dangerCooldown -= dt;
    if (inDanger && this.dangerCooldown <= 0) {
      this.needs.damage(8);
      this.dangerCooldown = 2.2;
      this.showToast("ابن آوى قريب منك — واصل التحرك");
    }

    const footprint = this.camel.consumeFootprint();
    if (footprint) this.world.addFootprint(footprint, this.camel.yaw);

    const collected = this.world.collectNearby(this.camel.position);
    if (collected) {
      this.needs.collect(collected);
      this.showToast(collected === "water" ? "جمعت قنينة ماء" : "جمعت تمرًا طازجًا");
    }

    const missionEvent = this.missions.update(this.camel.position);
    if (missionEvent) {
      if (this.missions.stage === 1) {
        this.camel.unlockSaddle();
        this.needs.thirst = Math.min(100, this.needs.thirst + 35);
        this.needs.water += 1;
      }
      this.showToast(missionEvent);
      this.world.setBeacon(this.missions.current?.target ?? null);
    }

    if (this.needs.health <= 0) {
      this.needs.health = 45;
      this.needs.thirst = 45;
      this.needs.hunger = 45;
      this.camel.position.set(48, terrainHeight(48, 35), 35);
      this.showToast("عثر مستكشفو المخيم على صحراء وأعادوها إلى مكان آمن");
    }

    this.toastRemaining = Math.max(0, this.toastRemaining - dt);
    if (this.toastRemaining === 0) this.toastText = "";
    this.applyAtmosphere();
    this.updateCamera(dt);
    this.uiElapsed += dt;
    if (this.uiElapsed > .12 || missionEvent || collected) {
      this.uiElapsed = 0;
      this.emitSnapshot();
    }
  }

  private applyAtmosphere() {
    const daylight = this.day.daylight;
    const night = new THREE.Color(0x17213a);
    const sunset = new THREE.Color(0xd48a4d);
    const day = new THREE.Color(0x9fcbd0);
    let sky = night.clone().lerp(daylight < .45 ? sunset : day, daylight);
    if (this.weather.current.kind === "sandstorm") sky = sky.lerp(new THREE.Color(0xa66c3d), .72);
    this.scene.background = sky;

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(sky).lerp(new THREE.Color(0xc58a4b), .3);
      this.scene.fog.density = this.weather.current.kind === "sandstorm" ? .026 : this.weather.current.kind === "windy" ? .009 : .0062;
    }

    this.hemisphere.intensity = .42 + daylight * 1.45;
    this.hemisphere.color.set(daylight > .25 ? 0xffddb0 : 0x6174a0);
    this.sun.intensity = .18 + daylight * 2.25;
    const angle = ((this.day.hour - 6) / 24) * Math.PI * 2;
    const sunY = Math.max(-18, Math.sin(angle) * 76);
    const sunX = Math.cos(angle) * 92;
    this.sun.position.set(sunX, sunY, -58);
    this.sun.target.position.copy(this.camel.position);
    this.sunDisk.position.copy(this.camera.position).add(new THREE.Vector3(sunX, sunY, -78).normalize().multiplyScalar(130));
    this.sunDisk.visible = sunY > -5 && this.weather.current.kind !== "sandstorm";
    (this.stars.material as THREE.PointsMaterial).opacity = Math.pow(1 - daylight, 2) * .82;
    this.stars.position.set(this.camel.position.x, 0, this.camel.position.z);
  }

  private updateCamera(dt: number) {
    const offset = new THREE.Vector3(0, 4.7, -9.3).applyAxisAngle(UP, this.camel.yaw);
    const targetPosition = this.camel.position.clone().add(offset);
    const follow = this.firstFrame ? 1 : 1 - Math.exp(-dt * 4.8);
    this.camera.position.lerp(targetPosition, follow);
    const forward = new THREE.Vector3(Math.sin(this.camel.yaw), 0, Math.cos(this.camel.yaw));
    const lookAt = this.camel.position.clone().add(new THREE.Vector3(0, 2.15, 0)).addScaledVector(forward, 2.5);
    this.camera.lookAt(lookAt);
    const targetFov = this.camel.sprinting ? 64 : 58;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3.5);
    this.camera.updateProjectionMatrix();
  }

  private showToast(message: string) {
    this.toastText = message;
    this.toastRemaining = 3.4;
    this.emitSnapshot();
  }

  private emitSnapshot() {
    const mission = this.missions.current;
    this.onUpdate({
      health: this.needs.health,
      stamina: this.needs.stamina,
      thirst: this.needs.thirst,
      hunger: this.needs.hunger,
      water: this.needs.water,
      dates: this.needs.dates,
      time: this.day.formatted,
      weather: this.weather.current.label,
      location: this.world.locationAt(this.camel.position),
      objective: mission?.title ?? "طريق دليلة القوافل",
      objectiveDetail: mission?.detail ?? "استكشف الصحراء بحرية واستعد لرحلة القافلة القادمة.",
      objectiveDistance: mission ? Math.round(this.camel.position.distanceTo(mission.target) * 18) : 0,
      level: this.missions.level,
      toast: this.toastText,
    });
  }

  private resize() {
    const width = Math.max(1, this.mount.clientWidth);
    const height = Math.max(1, this.mount.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.input.dispose();
    this.world.dispose();
    this.camel.dispose();
    this.sunDisk.geometry.dispose();
    (this.sunDisk.material as THREE.Material).dispose();
    this.stars.geometry.dispose();
    (this.stars.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
