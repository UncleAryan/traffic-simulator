const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const L = 500; // loop length (m)
const LANES = 3;
let N = 30; // number of cars

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// pseudo-3D projection: depth d=0 near road edge, d=1 far edge
function roadY(d) {
  return canvas.height * (0.80 - 0.38 * d);
}
function roadLeft(d) {
  return canvas.width * 0.14 * d;
}
function roadRight(d) {
  return canvas.width - roadLeft(d);
}
function project(x, lane) {
  const d = (lane + 0.5) / LANES;
  const sx = roadLeft(d) + (roadRight(d) - roadLeft(d)) * (x / L);
  return { sx, sy: roadY(d), scale: 1.15 - 0.45 * d };
}

const dt = 0.05; // fixed physics timestep (s)

// IDM parameters
let v0 = 20;          // desired speed (m/s)
let T = 1.5;          // desired time headway (s)
const s0 = 2;         // min bumper gap (m)
let a_max = 1.0;      // max accel (m/s^2)
let b = 1.5;          // comfy braking (m/s^2)
const carLength = 5;  // (m)

// MOBIL parameters
const P = 0.2;        // politeness
const ATHR = 0.2;     // gain threshold
const BSAFE = 4;      // max imposed braking

const cars = [];
function initCars() {
  cars.length = 0;
  for (let i = 0; i < N; i++) cars.push({ x: i * L / N, v: 15, lane: i % LANES, ly: i % LANES, cool: 0 });
}
initCars();

function idmAccel(v, s, dv) {
  const sStar = s0 + v * T + (v * dv) / (2 * Math.sqrt(a_max * b));
  return a_max * (1 - Math.pow(v / v0, 4) - Math.pow(sStar / s, 2));
}

function gapTo(car, lead) {
  return (lead.x - car.x + L) % L - carLength;
}

function accel(car, lead) {
  if (!lead) return idmAccel(car.v, L - carLength, 0);
  return idmAccel(car.v, Math.max(gapTo(car, lead), 0.01), car.v - lead.v);
}

function laneCars(lane) {
  return cars.filter(c => c.lane === lane).sort((a, b) => a.x - b.x);
}

function tryChange(car, t, curLead) {
  const target = laneCars(t);
  let newLead = null, newFollow = null;
  if (target.length) {
    newLead = target.find(c => c.x > car.x) || target[0];
    newFollow = target.findLast(c => c.x < car.x) || target[target.length - 1];
  }
  if (newLead && gapTo(car, newLead) <= 0) return false;
  if (newFollow && gapTo(newFollow, car) <= 0) return false;
  if (newFollow && accel(newFollow, car) < -BSAFE) return false;
  const gain = accel(car, newLead) - accel(car, curLead);
  const nfOld = newFollow ? accel(newFollow, target.length > 1 ? newLead : null) : 0;
  const nfNew = newFollow ? accel(newFollow, car) : 0;
  if (gain > P * (nfOld - nfNew) + ATHR) {
    car.lane = t;
    return true;
  }
  return false;
}

function update(dt) {
  const accels = new Map();
  for (let l = 0; l < LANES; l++) {
    const arr = laneCars(l);
    arr.forEach((car, i) => {
      accels.set(car, accel(car, arr.length > 1 ? arr[(i + 1) % arr.length] : null));
    });
  }
  for (const car of cars) {
    car.v = Math.max(car.v + accels.get(car) * dt, 0);
    car.x = (car.x + car.v * dt) % L;
    car.cool = Math.max(car.cool - dt, 0);
  }
  for (const car of cars) {
    if (car.cool > 0) continue;
    const arr = laneCars(car.lane);
    const i = arr.indexOf(car);
    const curLead = arr.length > 1 ? arr[(i + 1) % arr.length] : null;
    for (const t of [car.lane - 1, car.lane + 1]) {
      if (t < 0 || t >= LANES) continue;
      if (tryChange(car, t, curLead)) {
        car.cool = 2;
        break;
      }
    }
  }
}

function speedColor(v, light = 50) {
  return `hsl(${120 * Math.min(v / v0, 1)}, 85%, ${light}%)`;
}

function drawCar(car) {
  if (car.ly === undefined) car.ly = car.lane;
  car.ly += (car.lane - car.ly) * 0.1;
  const { sx, sy, scale } = project(car.x, car.ly);
  const w = 30 * scale, h = 11 * scale, roof = 6 * scale;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 2 * scale, w * 0.55, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = speedColor(car.v, 40);
  ctx.fillRect(sx - w / 2, sy - h, w, h);
  ctx.fillStyle = speedColor(car.v, 55);
  ctx.fillRect(sx - w / 2 + 3 * scale, sy - h - roof, w - 6 * scale, roof);
  ctx.fillStyle = 'rgba(40,60,90,0.9)';
  ctx.fillRect(sx + w / 2 - 8 * scale, sy - h - roof + 1, 3 * scale, roof - 2);
}

function draw() {
  const W = canvas.width, H = canvas.height;

  const sky = ctx.createLinearGradient(0, 0, 0, roadY(1));
  sky.addColorStop(0, '#87b5e0');
  sky.addColorStop(1, '#d8e8f5');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, roadY(1));
  ctx.fillStyle = '#6a9c59';
  ctx.fillRect(0, roadY(1), W, H - roadY(1));

  ctx.fillStyle = '#4a4a4f';
  ctx.beginPath();
  ctx.moveTo(roadLeft(0), roadY(0));
  ctx.lineTo(roadRight(0), roadY(0));
  ctx.lineTo(roadRight(1), roadY(1));
  ctx.lineTo(roadLeft(1), roadY(1));
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 3;
  for (const d of [0, 1]) {
    ctx.beginPath();
    ctx.moveTo(roadLeft(d), roadY(d));
    ctx.lineTo(roadRight(d), roadY(d));
    ctx.stroke();
  }
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 2;
  for (let l = 1; l < LANES; l++) {
    const d = l / LANES;
    const s = 1.15 - 0.45 * d;
    ctx.setLineDash([18 * s, 14 * s]);
    ctx.beginPath();
    ctx.moveTo(roadLeft(d), roadY(d));
    ctx.lineTo(roadRight(d), roadY(d));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const car of [...cars].sort((a, b) => b.ly - a.ly)) drawCar(car);
}

document.getElementById('brake').addEventListener('click', () => {
  cars[0].v = 0;
});

function bindSlider(id, apply) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    apply(+el.value);
    document.getElementById(id + '-val').textContent = el.value;
  });
}
bindSlider('n', val => { N = val; initCars(); });
bindSlider('v0', val => v0 = val);
bindSlider('T', val => T = val);
bindSlider('a_max', val => a_max = val);
bindSlider('b', val => b = val);

// frame-rate independent
// accumulate physics in fixed dt chunks
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min((now - last) / 1000, 0.25); // cap to avoid spiral after tab-away
  last = now;
  while (acc >= dt) { update(dt); acc -= dt; }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
