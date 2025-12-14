import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/Addons.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';

const IsometricRoom = () => {
  const canvasElement = document.querySelector('#room-canvas');

  if (!canvasElement) {
    console.warn('No canvas found');
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true });
  const camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 1000);
  const scene = new THREE.Scene();
  const controls = new OrbitControls(camera, renderer.domElement);
  const raycaster = new THREE.Raycaster();
  const pickableObjects: THREE.Mesh[] = [];
  const pickableObjectAnimateParent = new Set(['PicClover', 'PicCats', 'PicWork', 'PicScreen']);
  const pickableObjectExceptions = new Set(['Cat_tree']);
  const pointerPosition = new THREE.Vector2();

  let hoveredObject: THREE.Object3D | null = null;

  const setScene = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x181818);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    camera.coordinateSystem = THREE.WebGLCoordinateSystem;
    camera.position.set(60, 40, 60);

    controls.enableDamping = true;
    controls.target.set(-3, 7, 0);
    controls.maxDistance = 90;
    controls.minAzimuthAngle = -Math.PI / 40;
    controls.maxAzimuthAngle = Math.PI / 2;
    controls.minPolarAngle = -Math.PI / 40;
    controls.maxPolarAngle = Math.PI / 2;

    controls.update();

    camera.updateProjectionMatrix();
  };

  const setObjects = async () => {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    const textureLoader = new THREE.TextureLoader();

    dracoLoader.setDecoderPath('/draco/');
    gltfLoader.setDRACOLoader(dracoLoader);

    const configTexture = (texture: THREE.Texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
    };

    const roomGLTF = await gltfLoader.loadAsync('/models/isoroom-compressed.glb');
    const structuralTexture = await textureLoader.loadAsync('textures/TextureSet1_structural.webp');
    const noninteractiveTexture = await textureLoader.loadAsync(
      'textures/TextureSet2_noninteractive.webp',
    );
    const interactiveTexture = await textureLoader.loadAsync(
      'textures/TextureSet3_interactive.webp',
    );
    const envTexture = await textureLoader.loadAsync('textures/TextureSet4_env.webp');
    const picWallpaperTexture = await textureLoader.loadAsync('textures/Pic_Smiski_Wallpaper.jpeg');
    const picCloverTexture = await textureLoader.loadAsync('textures/Pic_Wall_Clover.jpeg');
    const picCatsTexture = await textureLoader.loadAsync('textures/Pic_Wall_Cats.jpeg');
    const picSmiskiWorkTexture = await textureLoader.loadAsync('textures/Pic_Wall_SmiskiWork.jpeg');

    scene.add(roomGLTF.scene);

    configTexture(structuralTexture);
    configTexture(envTexture);
    configTexture(noninteractiveTexture);
    configTexture(interactiveTexture);
    configTexture(picWallpaperTexture);
    configTexture(picCatsTexture);
    configTexture(picSmiskiWorkTexture);
    configTexture(picCloverTexture);

    const interactiveMaterial = new THREE.MeshBasicMaterial({ map: interactiveTexture });

    roomGLTF.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name == 'Background_Iso') {
        child.material = new THREE.MeshBasicMaterial({ map: envTexture });
      }

      if (child instanceof THREE.Mesh && child.name == 'PicScreen') {
        child.material = new THREE.MeshBasicMaterial({ map: picWallpaperTexture });
      }

      if (child instanceof THREE.Mesh && child.name == 'PicClover') {
        child.material = new THREE.MeshBasicMaterial({ map: picCloverTexture });
      }

      if (child instanceof THREE.Mesh && child.name == 'PicCats') {
        child.material = new THREE.MeshBasicMaterial({ map: picCatsTexture });
      }

      if (child instanceof THREE.Mesh && child.name == 'PicWork') {
        child.material = new THREE.MeshBasicMaterial({ map: picSmiskiWorkTexture });
      }

      if (child instanceof THREE.Mesh && child.name == 'Structural001') {
        child.material = new THREE.MeshBasicMaterial({ map: structuralTexture });
      }

      if (
        child instanceof THREE.Mesh &&
        child.parent &&
        child.parent.name == 'Interactives_Parent'
      ) {
        child.material = interactiveMaterial;

        if (child instanceof THREE.Mesh && child.name == 'Cup') {
          child.material = new THREE.MeshPhysicalMaterial({
            color: '#fff',
            transparent: true,
            transmission: 1,
            envMap: envTexture,
            opacity: 1,
            thickness: 1,
            roughness: 0.05,
            metalness: 0,
            envMapIntensity: 1,
            ior: 1.5,
          });
        }

        if (!pickableObjectExceptions.has(child.name)) pickableObjects.push(child);
      }

      if (
        child instanceof THREE.Mesh &&
        child.parent &&
        child.parent.name == 'Noninteractive_Parent'
      ) {
        child.material = new THREE.MeshBasicMaterial({ map: noninteractiveTexture });
      }
    });
  };

  const animateInteractiveObjects = (mouseEvent: MouseEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerPosition.x = ((mouseEvent.clientX - rect.left) / rect.width) * 2 - 1;
    pointerPosition.y = -((mouseEvent.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointerPosition, camera);

    const interactionIntersections = raycaster.intersectObjects(pickableObjects, true);

    if (interactionIntersections.length == 0) return;

    let nextObject = interactionIntersections[0].object ?? null;

    if (nextObject && pickableObjectAnimateParent.has(nextObject.name) && nextObject.parent) {
      nextObject = nextObject.parent;
    }

    if (nextObject === hoveredObject || !nextObject) return;

    if (hoveredObject) {
      hoveredObject.scale.set(1, 1, 1);
      gsap.killTweensOf(hoveredObject.scale);
      gsap.killTweensOf(hoveredObject.rotation);
      gsap.killTweensOf(hoveredObject.position);
    }

    hoveredObject = nextObject;

    if (pickableObjectAnimateParent.has(hoveredObject.name) && hoveredObject.parent) {
      hoveredObject = hoveredObject.parent;
    }

    if (hoveredObject.name == 'Tree_fuzz') {
      const swingAmount = THREE.MathUtils.degToRad(10);
      gsap.to(hoveredObject.rotation, {
        z: `+=${swingAmount}`,
        duration: 0.25,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      });
      return;
    }

    gsap.to(hoveredObject.scale, {
      x: 1.2,
      y: 1.2,
      z: 1.2,
      duration: 0.3,
      yoyo: true,
      repeat: 1,
      ease: 'back.out(1.7)',
    });
  };

  const setSceneEvents = () => {
    window.addEventListener(
      'resize',
      debounce(() => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }),
    );

    window.addEventListener('mousemove', (event) => {
      debounce(() => animateInteractiveObjects(event));
    });
  };

  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };

  const debounce = <T extends Function>(cb: T, wait = 20): T => {
    let timer = 0;
    const callable = (...args: any[]) => {
      clearTimeout(timer);
      timer = setTimeout(() => cb(...args), wait);
    };

    return callable as any as T;
  };

  // Load
  setScene();
  setSceneEvents();
  setObjects();
  animate();
};

document.addEventListener('DOMContentLoaded', () => {
  IsometricRoom();
});
