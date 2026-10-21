import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { STLLoader } from 'three/addons/STLLoader.js';

// i due modelli: stesso sistema di coordinate, mostrati così come sono (nessun montaggio)
const MODELLI = { m1: 'modello/corpo-chlora.stl', m2: 'modello/disco.stl' };

const $ = (id) => document.getElementById(id);
const contenitore = $('scena');
const stato = $('stato');
const riduciMoto = matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
contenitore.appendChild(renderer.domElement);

const scena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 5000);

// luci: chiave calda-bianca, riempimento petrolio, controluce viola
scena.add(new THREE.HemisphereLight(0xdcd8ff, 0x1a1340, 1.1));
const chiave = new THREE.DirectionalLight(0xffffff, 2.2); chiave.position.set(1, 1.6, 1.2); scena.add(chiave);
const riempi = new THREE.DirectionalLight(0x4fc6de, 1.1); riempi.position.set(-1.4, 0.4, 0.6); scena.add(riempi);
const contro = new THREE.DirectionalLight(0x8a63e6, 1.4); contro.position.set(0, 0.8, -1.5); scena.add(contro);

const controlli = new OrbitControls(camera, renderer.domElement);
controlli.enableDamping = true;
controlli.dampingFactor = 0.07;
controlli.screenSpacePanning = true;
controlli.autoRotateSpeed = 0.45; // lenta
controlli.listenToKeyEvents(contenitore); // frecce = spostamento
controlli.keyPanSpeed = 14;

// materiali
const matPieno = new THREE.MeshStandardMaterial({
  color: 0xeceaff, roughness: 0.48, metalness: 0.05,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
});
const matFilo = new THREE.MeshBasicMaterial({
  color: 0xf4f3ff, wireframe: true, transparent: true, opacity: 0.8, depthWrite: false
});

const disposizioni = {};
let disposizioneAttiva = null;
let vistaIniziale = null;

// pavimento: griglia sottile che sfuma ai bordi (texture disegnata su canvas)
function texturaGriglia() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(170,150,240,0.55)'; g.lineWidth = 1.5;
  for (let i = 0; i <= 24; i++) {
    const p = Math.round(i * 1024 / 24) + 0.5;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(1024, p); g.stroke();
  }
  g.globalCompositeOperation = 'destination-in';
  const r = g.createRadialGradient(512, 512, 60, 512, 512, 512);
  r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 1024, 1024);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const pavimento = new THREE.Mesh(
  new THREE.PlaneGeometry(26, 26),
  new THREE.MeshBasicMaterial({ map: texturaGriglia(), transparent: true, opacity: 0.45, depthWrite: false })
);
pavimento.rotation.x = -Math.PI / 2;
scena.add(pavimento);

function creaDisposizione(geometrie) {
  const gruppo = new THREE.Group();
  const interno = new THREE.Group();
  gruppo.add(interno);
  const pieni = [], fili = [];
  for (const g of geometrie) {
    const p = new THREE.Mesh(g, matPieno);
    const f = new THREE.Mesh(g, matFilo);
    f.renderOrder = 1;
    pieni.push(p); fili.push(f);
    interno.add(p, f);
  }
  interno.rotation.x = -Math.PI / 2; // STL: Z in alto → Y in alto
  interno.updateMatrixWorld(true);
  // centra e porta a una misura fissa (solo per l'inquadratura, le posizioni relative restano quelle dei file)
  const box = new THREE.Box3().setFromObject(interno);
  const dim = box.getSize(new THREE.Vector3());
  const scala = 10 / Math.max(dim.x, dim.y, dim.z);
  interno.scale.multiplyScalar(scala);
  interno.updateMatrixWorld(true);
  box.setFromObject(interno);
  interno.position.sub(box.getCenter(new THREE.Vector3()));
  gruppo.updateMatrixWorld(true);
  gruppo.visible = false;
  scena.add(gruppo);
  return { gruppo, pieni, fili, box: new THREE.Box3().setFromObject(gruppo) };
}

async function carica() {
  const loader = new STLLoader();
  const [g1, g2] = await Promise.all([MODELLI.m1, MODELLI.m2].map((u) => loader.loadAsync(u)));
  g1.computeVertexNormals(); g2.computeVertexNormals();
  disposizioni.tutti = creaDisposizione([g1, g2]);
  disposizioni.m1 = creaDisposizione([g1]);
  disposizioni.m2 = creaDisposizione([g2]);
  mostra(document.querySelector('input[name="disp"]:checked').value);
  stato.classList.add('via');
}

function mostra(nome) {
  const d = disposizioni[nome];
  if (!d) return;
  for (const k in disposizioni) disposizioni[k].gruppo.visible = k === nome;
  disposizioneAttiva = d;
  pavimento.position.y = d.box.min.y - 0.6;
  impostaModo(document.querySelector('input[name="modo"]:checked').value);
  inquadra(d.box);
}
document.querySelectorAll('input[name="disp"]').forEach((r) =>
  r.addEventListener('change', () => { mostra(r.value); pausa(); }));

function inquadra(box) {
  const sfera = box.getBoundingSphere(new THREE.Sphere());
  const fovV = THREE.MathUtils.degToRad(camera.fov);
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
  const mobile = innerWidth < 760;
  const dist = (sfera.radius * (mobile ? 1.22 : 1.08)) / Math.sin(Math.min(fovV, fovH) / 2);
  const dir = new THREE.Vector3(0.62, 0.36, 1).normalize();
  // su mobile i comandi occupano la parte bassa: sposto il modello in alto
  const bersaglio = sfera.center.clone();
  if (mobile) bersaglio.y -= sfera.radius * 0.45;
  vistaIniziale = { pos: bersaglio.clone().add(dir.multiplyScalar(dist)), target: bersaglio };
  controlli.minDistance = sfera.radius * 0.3;
  controlli.maxDistance = dist * 3;
  ripristina();
}

function ripristina() {
  if (!vistaIniziale) return;
  camera.position.copy(vistaIniziale.pos);
  controlli.target.copy(vistaIniziale.target);
  camera.updateProjectionMatrix();
  controlli.update();
}

// rotazione automatica: si ferma quando tocchi, riparte dopo qualche secondo
let giroAttivo = !riduciMoto;
let timerRipresa = null;
controlli.autoRotate = giroAttivo;
const bGiro = $('b-giro');
function aggiornaGiro() {
  bGiro.setAttribute('aria-pressed', String(giroAttivo));
  $('t-giro').textContent = giroAttivo ? 'Ferma la rotazione' : 'Avvia la rotazione';
  bGiro.title = giroAttivo ? 'Ferma la rotazione' : 'Avvia la rotazione';
}
aggiornaGiro();
bGiro.addEventListener('click', () => {
  giroAttivo = !giroAttivo;
  clearTimeout(timerRipresa);
  controlli.autoRotate = giroAttivo;
  aggiornaGiro();
});
function pausa() {
  controlli.autoRotate = false;
  clearTimeout(timerRipresa);
  if (giroAttivo) timerRipresa = setTimeout(() => { controlli.autoRotate = giroAttivo; }, 3500);
}
controlli.addEventListener('start', () => { controlli.autoRotate = false; clearTimeout(timerRipresa); });
controlli.addEventListener('end', pausa);

// zoom da pulsanti e tastiera
function zoom(fattore) {
  const v = camera.position.clone().sub(controlli.target);
  const d = THREE.MathUtils.clamp(v.length() * fattore, controlli.minDistance, controlli.maxDistance);
  camera.position.copy(controlli.target).add(v.setLength(d));
  controlli.update();
  pausa();
}
$('b-piu').addEventListener('click', () => zoom(0.8));
$('b-meno').addEventListener('click', () => zoom(1.25));
$('b-reset').addEventListener('click', () => { ripristina(); pausa(); });
contenitore.addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') { zoom(0.85); e.preventDefault(); }
  else if (e.key === '-' || e.key === '_') { zoom(1.18); e.preventDefault(); }
  else if (e.key === 'r' || e.key === 'R') { ripristina(); pausa(); }
  else if (e.key.startsWith('Arrow')) pausa();
});

// superficie e wireframe
const gFilo = $('g-filo');
function impostaModo(modo) {
  const conPieno = modo !== 'filo', conFilo = modo !== 'solido';
  for (const k in disposizioni) {
    disposizioni[k].pieni.forEach((m) => (m.visible = conPieno));
    disposizioni[k].fili.forEach((m) => (m.visible = conFilo));
  }
  gFilo.classList.toggle('spento', !conFilo);
  gFilo.toggleAttribute('disabled', !conFilo);
}
document.querySelectorAll('input[name="modo"]').forEach((r) =>
  r.addEventListener('change', () => impostaModo(r.value)));

const libero = $('c-libero');
document.querySelectorAll('input[name="colore"]').forEach((r) =>
  r.addEventListener('change', () => {
    matFilo.color.set(r.value);
    libero.parentElement.classList.remove('attivo');
  }));
libero.addEventListener('input', () => {
  matFilo.color.set(libero.value);
  document.querySelectorAll('input[name="colore"]').forEach((r) => (r.checked = false));
  libero.parentElement.classList.add('attivo');
  libero.parentElement.style.background = libero.value;
});
const rOp = $('r-opacita');
rOp.addEventListener('input', () => {
  matFilo.opacity = rOp.value / 100;
  rOp.setAttribute('aria-valuetext', `${rOp.value} per cento`);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => { controlli.update(); renderer.render(scena, camera); });

carica().catch((err) => {
  console.error(err);
  stato.textContent = 'Non riesco a caricare il modello. Apri la pagina da un server (non come file locale).';
});

// per i test
window.__admaire = { impostaModo, controlli, matFilo };
