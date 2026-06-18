<template>
  <div class="monitor-container">
    <header class="monitor-header">
      <h1>🏭 库房叉车定位监控</h1>
    </header>
    <div class="monitor-body">
      <div class="canvas-wrap" ref="canvasWrap">
        <canvas ref="canvasEl"></canvas>
      </div>
      <div class="info-panel">
        <h2>叉车实时状态</h2>
        <ul class="forklift-list">
          <li v-for="f in forklifts" :key="f.id" class="forklift-item">
            <span class="forklift-id">{{ f.id }}</span>
            <span class="forklift-speed">
              速度: <strong>{{ f.speed }}</strong> m/s
            </span>
            <span class="forklift-pos">
              ({{ f.x }}, {{ f.y }})
            </span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const WAREHOUSE_W = 50;
const WAREHOUSE_H = 30;

export default {
  setup() {
    const canvasEl = ref(null);
    const canvasWrap = ref(null);
    const forklifts = ref([
      { id: 'F-001', x: 0, y: 0, speed: 0 },
      { id: 'F-002', x: 0, y: 0, speed: 0 },
      { id: 'F-003', x: 0, y: 0, speed: 0 },
    ]);

    let scene, camera, renderer, controls;
    let cubes = [];
    let ws = null;
    let animId = null;
    const ANIM_DURATION = 500;
    const animStates = [
      { startX: 0, startZ: 0, endX: 0, endZ: 0, startTime: 0 },
      { startX: 0, startZ: 0, endX: 0, endZ: 0, startTime: 0 },
      { startX: 0, startZ: 0, endX: 0, endZ: 0, startTime: 0 },
    ];

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function startAnim(index, x, z) {
      const now = performance.now();
      const state = animStates[index];
      const prevT = Math.min(1, (now - state.startTime) / ANIM_DURATION);
      const easedPrevT = easeInOutCubic(prevT);
      state.startX = state.startX + (state.endX - state.startX) * easedPrevT;
      state.startZ = state.startZ + (state.endZ - state.startZ) * easedPrevT;
      state.endX = x;
      state.endZ = z;
      state.startTime = now;
    }

    function initThree() {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);

      camera = new THREE.PerspectiveCamera(
        50,
        canvasWrap.value.clientWidth / canvasWrap.value.clientHeight,
        0.1,
        500
      );
      camera.position.set(WAREHOUSE_W / 2, 40, WAREHOUSE_H + 20);

      renderer = new THREE.WebGLRenderer({
        canvas: canvasEl.value,
        antialias: true,
      });
      renderer.setSize(canvasWrap.value.clientWidth, canvasWrap.value.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(WAREHOUSE_W / 2, 0, WAREHOUSE_H / 2);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.update();

      const floorGeo = new THREE.PlaneGeometry(WAREHOUSE_W, WAREHOUSE_H);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.9,
        metalness: 0.1,
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(WAREHOUSE_W / 2, 0, WAREHOUSE_H / 2);
      scene.add(floor);

      const gridHelper = new THREE.GridHelper(WAREHOUSE_W, 25, 0x444444, 0x555555);
      gridHelper.position.set(WAREHOUSE_W / 2, 0.01, WAREHOUSE_H / 2);
      scene.add(gridHelper);

      const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(WAREHOUSE_W, WAREHOUSE_H));
      const borderMat = new THREE.LineBasicMaterial({ color: 0xffff00 });
      const borderLine = new THREE.LineSegments(borderGeo, borderMat);
      borderLine.rotation.x = -Math.PI / 2;
      borderLine.position.set(WAREHOUSE_W / 2, 0.02, WAREHOUSE_H / 2);
      scene.add(borderLine);

      const colors = [0xff2222, 0xff6622, 0xff2222];
      for (let i = 0; i < 3; i++) {
        const geo = new THREE.BoxGeometry(2, 1.5, 1.5);
        const mat = new THREE.MeshStandardMaterial({
          color: colors[i],
          roughness: 0.4,
          metalness: 0.3,
          emissive: 0x660000,
        });
        const cube = new THREE.Mesh(geo, mat);
        cube.position.y = 0.75;
        scene.add(cube);
        cubes.push(cube);
      }

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(20, 30, 10);
      scene.add(dirLight);

      const pointLight = new THREE.PointLight(0xff4444, 0.5, 50);
      pointLight.position.set(WAREHOUSE_W / 2, 10, WAREHOUSE_H / 2);
      scene.add(pointLight);

      animate();
    }

    function animate() {
      animId = requestAnimationFrame(animate);
      const now = performance.now();
      cubes.forEach((cube, i) => {
        const state = animStates[i];
        const t = Math.min(1, (now - state.startTime) / ANIM_DURATION);
        const eased = easeInOutCubic(t);
        cube.position.x = state.startX + (state.endX - state.startX) * eased;
        cube.position.z = state.startZ + (state.endZ - state.startZ) * eased;
      });
      controls.update();
      renderer.render(scene, camera);
    }

    function connectWS() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${location.host}/forklift-ws`);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        data.forEach((item, i) => {
          forklifts.value[i] = { ...item };
          startAnim(i, item.x, item.y);
        });
      };

      ws.onclose = () => {
        setTimeout(connectWS, 2000);
      };
    }

    function onResize() {
      if (!canvasWrap.value) return;
      camera.aspect = canvasWrap.value.clientWidth / canvasWrap.value.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasWrap.value.clientWidth, canvasWrap.value.clientHeight);
    }

    onMounted(() => {
      initThree();
      connectWS();
      window.addEventListener('resize', onResize);
    });

    onBeforeUnmount(() => {
      if (animId) cancelAnimationFrame(animId);
      if (ws) ws.close();
      window.removeEventListener('resize', onResize);
      renderer?.dispose();
    });

    return { canvasEl, canvasWrap, forklifts };
  },
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f0f1a;
  color: #e0e0e0;
}

.monitor-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.monitor-header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 16px 24px;
  border-bottom: 2px solid #e94560;
}

.monitor-header h1 {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}

.monitor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.canvas-wrap {
  flex: 1;
  position: relative;
}

.canvas-wrap canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.info-panel {
  width: 300px;
  background: #1a1a2e;
  border-left: 2px solid #e94560;
  padding: 24px;
  overflow-y: auto;
}

.info-panel h2 {
  font-size: 18px;
  margin-bottom: 20px;
  color: #e94560;
  border-bottom: 1px solid #333;
  padding-bottom: 10px;
}

.forklift-list {
  list-style: none;
}

.forklift-item {
  background: #16213e;
  border: 1px solid #2a2a4a;
  border-left: 4px solid #e94560;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.3s;
}

.forklift-item:hover {
  border-left-color: #ff6b6b;
}

.forklift-id {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}

.forklift-speed {
  font-size: 14px;
  color: #aaa;
}

.forklift-speed strong {
  color: #e94560;
  font-size: 20px;
}

.forklift-pos {
  font-size: 12px;
  color: #666;
  font-family: 'Courier New', monospace;
}
</style>
