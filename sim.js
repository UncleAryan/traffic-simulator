const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const L = 500;   // loop length (m)
const N = 30;    // number of cars

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

const cars = [];
for (let i = 0; i < N; i++) cars.push({ x: i * L / N, v: 0 });

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
    ctx.fillStyle = '#4caf50';
    ctx.fill();
  }
}

function frame() {
  draw();
  requestAnimationFrame(frame);
}
frame();
