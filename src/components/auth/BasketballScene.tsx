import { useEffect, useRef } from 'react';

const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.min.js';

function seededPoints(count: number, radius: number) {
  let seed = 9173;
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  return Array.from({ length: count }, () => [
    (next() - 0.5) * radius,
    (next() - 0.5) * radius,
    (next() - 0.5) * radius,
  ] as const);
}

export function BasketballScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let frame = 0;
    let cleanup: (() => void) | undefined;

    async function mountScene() {
      try {
        const THREE = await import(/* @vite-ignore */ THREE_MODULE_URL);
        if (disposed || !host) return;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050913, 0.055);

        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        camera.position.set(0, 0.15, 7.4);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setClearColor(0x050913, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.appendChild(renderer.domElement);

        const world = new THREE.Group();
        scene.add(world);

        const ball = new THREE.Group();
        ball.rotation.set(-0.22, -0.5, 0.08);
        world.add(ball);

        const basketballMaterial = new THREE.MeshStandardMaterial({
          color: 0xb84a16,
          roughness: 0.83,
          metalness: 0.03,
          bumpScale: 0.03,
        });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.66, 96, 64), basketballMaterial);
        ball.add(sphere);

        const seamMaterial = new THREE.MeshStandardMaterial({ color: 0x160b07, roughness: 0.9, metalness: 0 });
        const seamGeometry = new THREE.TorusGeometry(1.672, 0.026, 12, 128);
        const seamA = new THREE.Mesh(seamGeometry, seamMaterial);
        seamA.rotation.x = Math.PI / 2;
        ball.add(seamA);

        const seamB = new THREE.Mesh(seamGeometry, seamMaterial);
        seamB.rotation.y = Math.PI / 2;
        ball.add(seamB);

        const seamC = new THREE.Mesh(seamGeometry, seamMaterial);
        seamC.rotation.set(Math.PI / 2, Math.PI / 4, 0);
        ball.add(seamC);

        const seamD = new THREE.Mesh(seamGeometry, seamMaterial);
        seamD.rotation.set(Math.PI / 2, -Math.PI / 4, 0);
        ball.add(seamD);

        const ambient = new THREE.HemisphereLight(0x6d9fff, 0x08030b, 1.15);
        scene.add(ambient);

        const key = new THREE.DirectionalLight(0xffb076, 4.4);
        key.position.set(-3.5, 3.2, 5);
        scene.add(key);

        const electric = new THREE.PointLight(0x2e8bff, 0, 13, 2);
        electric.position.set(2.8, 0.8, 3.4);
        scene.add(electric);

        const rim = new THREE.PointLight(0x327cff, 5.5, 14, 2);
        rim.position.set(-3.6, -1.8, 0.8);
        scene.add(rim);

        const particlePositions = seededPoints(110, 13).flat();
        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
        const particles = new THREE.Points(
          particleGeometry,
          new THREE.PointsMaterial({ color: 0x6faaff, size: 0.018, transparent: true, opacity: 0.32 })
        );
        scene.add(particles);

        const boltMaterial = new THREE.LineBasicMaterial({ color: 0x78b8ff, transparent: true, opacity: 0 });
        const boltGeometry = new THREE.BufferGeometry();
        const bolt = new THREE.Line(boltGeometry, boltMaterial);
        scene.add(bolt);

        const setBolt = (phase: number) => {
          const points = [];
          for (let i = 0; i < 10; i += 1) {
            const t = i / 9;
            points.push(
              new THREE.Vector3(
                2.85 - t * 1.35 + Math.sin(phase * 7 + i * 2.3) * 0.08,
                1.45 - t * 1.1 + Math.cos(phase * 5 + i * 1.6) * 0.1,
                2.2 + Math.sin(i * 3.1) * 0.08
              )
            );
          }
          boltGeometry.setFromPoints(points);
        };

        const pointer = { x: 0, y: 0 };
        const onPointerMove = (event: PointerEvent) => {
          pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
          pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
        };
        window.addEventListener('pointermove', onPointerMove, { passive: true });

        const clock = new THREE.Clock();
        let lastElapsed = 0;
        let flashAt = 1.7;

        const resize = () => {
          const width = host.clientWidth || window.innerWidth;
          const height = host.clientHeight || window.innerHeight;
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(height, 1);
          camera.updateProjectionMatrix();

          const mobile = width < 640;
          world.position.set(mobile ? 0 : -1.55, mobile ? 0.65 : 0.05, 0);
          world.scale.setScalar(mobile ? 0.84 : 1.02);
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(host);

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const animate = () => {
          const elapsed = clock.getElapsedTime();
          const delta = elapsed - lastElapsed;
          lastElapsed = elapsed;

          if (!reducedMotion) {
            ball.rotation.y += delta * 0.17;
            ball.rotation.x = -0.22 + Math.sin(elapsed * 0.28) * 0.035;
            particles.rotation.y = elapsed * 0.012;
            world.rotation.y += (pointer.x * 0.055 - world.rotation.y) * 0.025;
            world.rotation.x += (-pointer.y * 0.025 - world.rotation.x) * 0.025;

            const cycle = elapsed % 5.6;
            const flash = cycle > flashAt && cycle < flashAt + 0.11
              ? Math.sin(((cycle - flashAt) / 0.11) * Math.PI)
              : 0;
            electric.intensity = flash * 18;
            boltMaterial.opacity = flash * 0.78;
            if (flash > 0) setBolt(elapsed);
            if (cycle > 5.45) flashAt = 1.2 + ((Math.sin(elapsed * 1.73) + 1) / 2) * 1.8;
          } else {
            electric.intensity = 0;
            boltMaterial.opacity = 0;
          }

          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(animate);
        };
        animate();

        cleanup = () => {
          window.cancelAnimationFrame(frame);
          window.removeEventListener('pointermove', onPointerMove);
          observer.disconnect();
          boltGeometry.dispose();
          boltMaterial.dispose();
          particleGeometry.dispose();
          particles.material.dispose();
          seamGeometry.dispose();
          seamMaterial.dispose();
          sphere.geometry.dispose();
          basketballMaterial.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        host?.setAttribute('data-scene-unavailable', 'true');
      }
    }

    void mountScene();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_28%_35%,hsl(213_94%_62%/0.09),transparent_34%),linear-gradient(180deg,hsl(222_47%_5%),hsl(222_52%_3%))]"
    />
  );
}
