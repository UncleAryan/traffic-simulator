const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const L = 500; // loop length (m)
const N = 30; // number of cars

let cx, cy, radius;
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  cx = canvas.width / 2;
  cy = canvas.height / 2;
  radius = Math.min(cx, cy) * 0.8;
}
addEventListener('resize', resize);
resize();

function posToXY(x) {
  const angle = 2 * Math.PI * x / L;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

const dt = 0.05; // fixed physics timestep (s)

// IDM parameters
const v0 = 20;        // desired speed (m/s)
const T = 1.5;        // desired time headway (s)
const s0 = 2;         // minimum bumper gap (m)
const a_max = 1.0;    // max acceleration (m/s^2)
const b = 1.5;        // comfortable braking (m/s^2)
const carLength = 5;  // (m)

// Cars stay sorted by x: single lane, no overtaking, so index order never changes.
// Car ahead of i is (i+1) % N.
const cars = [];
for (let i = 0; i < N; i++) cars.push({ x: i * L / N, v: 15 });

// IDM acceleration from own speed, gap to leader, and closing speed
function idmAccel(v, s, dv) {
  const sStar = s0 + v * T + (v * dv) / (2 * Math.sqrt(a_max * b));
  return a_max * (1 - Math.pow(v / v0, 4) - Math.pow(sStar / s, 2));
}

function update(dt) {
  // compute all accelerations from current state before moving anyone
  const accels = cars.map((car, i) => {
    const lead = cars[(i + 1) % N];
    const s = (lead.x - car.x + L) % L - carLength; // bumper gap, wrap-safe
    return idmAccel(car.v, Math.max(s, 0.01), car.v - lead.v);
  });
  cars.forEach((car, i) => {
    car.v = Math.max(car.v + accels[i] * dt, 0);
    car.x = (car.x + car.v * dt) % L;
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // road ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 14;
  ctx.stroke();

  // cars
  for (const car of cars) {
    const p = posToXY(car.x);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = `hsl(${120 * Math.min(car.v / v0, 1)}, 90%, 50%)`;
    ctx.fill();
  }
}

document.getElementById('brake').addEventListener('click', () => {
  cars[0].v = 0;
});

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
