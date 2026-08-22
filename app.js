const svg = document.querySelector('#board');
const controls = Object.fromEntries(['shape', 'columns', 'rows', 'projection', 'terrain'].map((id) => [id, document.querySelector(`#${id}`)]));
const state = { shape: 'hex', columns: 9, rows: 7, projection: 'top', terrain: 'plain', unit: { q: 0, r: 0 } };

// Logical coordinates are deliberately independent from the chosen projection.
const geometry = {
  square(q, r, size) { return { x: q * size * 1.03, y: r * size * 1.03, points: [[0,0],[1,0],[1,1],[0,1]].map(([x,y]) => [x * size, y * size]) }; },
  hex(q, r, size) { const w = Math.sqrt(3) * size, x = w * (q + r / 2), y = size * 1.5 * r; return { x, y, points: Array.from({length:6},(_,i) => { const a = Math.PI/180*(60*i-30); return [Math.cos(a)*size, Math.sin(a)*size]; }) }; }
};
const project = (x, y, height) => state.projection === 'iso' ? { x: (x - y) * .9, y: (x + y) * .43 - height } : { x, y: y - height };
const elevation = (q, r) => { if (state.terrain === 'plain') return 0; const cx=(state.columns-1)/2, cy=(state.rows-1)/2, d=Math.hypot(q-cx,r-cy); return state.terrain === 'sphere' ? Math.max(0, 75 - d*d*5) : (Math.sin(q*.9)+Math.cos(r*1.2)+2)*12; };
const color = (q,r,h) => { const n=(q*13+r*7)%3; const base = ['#285b63','#2e6870','#397272'][n]; return h ? `hsl(${state.terrain === 'sphere' ? 194 : 169} ${42+h/8}% ${28+h/3}%)` : base; };

function draw() {
  Object.assign(state, { shape: controls.shape.value, columns:+controls.columns.value, rows:+controls.rows.value, projection:controls.projection.value, terrain:controls.terrain.value });
  state.unit.q = Math.min(state.unit.q, state.columns - 1); state.unit.r = Math.min(state.unit.r, state.rows - 1);
  document.querySelector('#columns-output').value=state.columns; document.querySelector('#rows-output').value=state.rows;
  document.querySelector('#grid-summary').textContent=`${state.columns} × ${state.rows} · ${state.columns*state.rows} ячейки`;
  document.querySelector('#position').textContent=`q: ${state.unit.q} · r: ${state.unit.r}`;
  const tiles=[]; const size=state.shape==='hex'?39:53;
  for(let r=0;r<state.rows;r++) for(let q=0;q<state.columns;q++) {
    const cell=geometry[state.shape](q,r,size), h=elevation(q,r), p=project(cell.x,cell.y,h);
    // Keep coordinates as numbers while calculating bounds. This avoids parsing SVG strings
    // and makes rendering stable when trigonometry produces exponential notation.
    const vertices=cell.points.map(([x,y]) => [p.x+x,p.y+y]);
    const points=vertices.map(([x,y])=>`${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    tiles.push({q,r,h,p,points,vertices});
  }
  const xs=tiles.flatMap(t=>t.vertices.map(([x])=>x)), ys=tiles.flatMap(t=>t.vertices.map(([,y])=>y));
  const offsetX=500-(Math.min(...xs)+Math.max(...xs))/2, offsetY=350-(Math.min(...ys)+Math.max(...ys))/2+15;
  svg.innerHTML = `<g transform="translate(${offsetX} ${offsetY})">${tiles.map(t=>`<polygon class="tile" data-q="${t.q}" data-r="${t.r}" points="${t.points}" fill="${color(t.q,t.r,t.h)}" stroke="#5ca6a2" stroke-opacity=".45"/>`).join('')}${state.terrain!=='plain'?tiles.filter(t=>(t.q+t.r)%2===0).map(t=>`<path class="terrain-line" d="M ${t.p.x-12} ${t.p.y} q 12 -8 24 0"/>`).join(''):''}${unitMarkup(tiles.find(t=>t.q===state.unit.q&&t.r===state.unit.r))}</g>`;
}
function unitMarkup(tile) { const x=tile.p.x, y=tile.p.y-tile.h-5; return `<ellipse class="unit-shadow" cx="${x}" cy="${y+15}" rx="14" ry="5"/><circle class="unit" cx="${x}" cy="${y}" r="14"/><path class="unit-core" d="M ${x} ${y-7} l 6 7 -6 7 -6-7z"/>`; }
svg.addEventListener('click', (event) => { const tile=event.target.closest('.tile'); if(!tile)return; state.unit={q:+tile.dataset.q,r:+tile.dataset.r}; draw(); });
Object.values(controls).forEach(control=>control.addEventListener('input',draw));
document.querySelector('#reset').addEventListener('click',()=>{state.unit={q:0,r:0};draw();});
draw();
