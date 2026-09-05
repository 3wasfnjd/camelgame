import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type LoadedModel = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

export const MODEL_PATHS = {
  camel: "models/camel.glb",
  oasis: "models/oasis.glb",
  camp: "models/camp.glb",
  ruins: "models/ruins.glb",
  village: "models/village.glb",
} as const;

export async function loadOptionalModel(name: keyof typeof MODEL_PATHS): Promise<LoadedModel | null> {
  const base = import.meta.env.BASE_URL || "/";
  const url = new URL(`${base}${MODEL_PATHS[name]}`, window.location.href).href;
  const loader = new GLTFLoader();

  try {
    const model = await loader.loadAsync(url);
    return { scene: model.scene, animations: model.animations };
  } catch {
    return null;
  }
}

export function fitModelToHeight(model: THREE.Object3D, targetHeight: number) {
  const initialBox = new THREE.Box3().setFromObject(model);
  const size = initialBox.getSize(new THREE.Vector3());
  if (size.y <= 0) return;

  const scale = targetHeight / size.y;
  model.scale.setScalar(scale);
  const fittedBox = new THREE.Box3().setFromObject(model);
  const center = fittedBox.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= fittedBox.min.y;
}
