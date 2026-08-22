const svg = document.querySelector('#board');
const controls = Object.fromEntries(['shape', 'columns', 'rows', 'projection', 'tilt', 'plane-tilt', 'terrain', 'curvature'].map((id) => [id, document.querySelector(`#${id}`)]));
const state = { shape: 'hex', columns: 15, rows: 15, projection: 'top', tilt: 30, planeTilt: 0, terrain: 'plain', curvature: 65, rotation: 0, unit: { q: 0, r: 0 } };

// Logical coordinates are deliberately independent from the chosen projection.
const geometry = {
  square(q, r, size) { return { x: q * size, y: r * size, points: [[0,0],[1,0],[1,1],[0,1]].map(([x,y]) => [x * size, y * size]) }; },
  // Odd-row offset layout: rows 1, 3, 5… align with each other, while rows 2, 4, 6… are shifted by half a cell.
  // This produces a rectangular map footprint instead of the diagonal axial-grid parallelogram.
  hex(q, r, size) { const w = Math.sqrt(3) * size, x = w * (q + (r % 2) * .5), y = size * 1.5 * r; return { x, y, points: Array.from({length:6},(_,i) => { const a = Math.PI/180*(60*i-30); return [Math.cos(a)*size, Math.sin(a)*size]; }) }; }
};
const project = (x, y, height) => {
  if (state.projection === 'top') return { x, y: y - height };
  const verticalScale=.86*Math.sin(state.tilt*Math.PI/180);
  return { x: (x-y)*.9, y: (x+y)*verticalScale-height };
};
const terrainHeightAt = (x, y, bounds) => {
  if (state.terrain === 'plain') return 0;
  const nx=(x-(bounds.minX+bounds.maxX)/2)/((bounds.maxX-bounds.minX)/2);
  const ny=(y-(bounds.minY+bounds.maxY)/2)/((bounds.maxY-bounds.minY)/2);
  // A spherical cap: equal normalized radii in both axes make height fall away from the centre in every direction.
  if (state.terrain === 'sphere') return state.curvature/100*82*Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
  return (Math.sin(nx*Math.PI*3)+Math.cos(ny*Math.PI*3)+2)*11;
};
const rotateWorld = (x, y, bounds) => {
  const angle=state.rotation*Math.PI/180, cx=(bounds.minX+bounds.maxX)/2, cy=(bounds.minY+bounds.maxY)/2;
  const dx=x-cx, dy=y-cy, cos=Math.cos(angle), sin=Math.sin(angle);
  return [cx+dx*cos-dy*sin,cy+dx*sin+dy*cos];
};
const inclinePlane = (x, y, height) => {
  const angle=state.planeTilt*Math.PI/180;
  // Rotate the field around its horizontal world axis; terrain height remains normal to that plane.
  return [x,y*Math.cos(angle),height+y*Math.sin(angle)];
};
const color = (q,r,h) => { const n=(q*13+r*7)%3; const base = ['#285b63','#2e6870','#397272'][n]; return h ? `hsl(${state.terrain === 'sphere' ? 194 : 169} ${42+h/8}% ${28+h/3}%)` : base; };

function draw() {
  Object.assign(state, { shape: controls.shape.value, columns:+controls.columns.value, rows:+controls.rows.value, projection:controls.projection.value, tilt:+controls.tilt.value, planeTilt:+controls['plane-tilt'].value, terrain:controls.terrain.value, curvature:+controls.curvature.value });
  state.unit.q = Math.min(state.unit.q, state.columns - 1); state.unit.r = Math.min(state.unit.r, state.rows - 1);
  document.querySelector('#columns-output').value=state.columns; document.querySelector('#rows-output').value=state.rows;
  document.querySelector('#tilt-output').value=`${state.tilt}°`; document.querySelector('#plane-tilt-output').value=`${state.planeTilt}°`; document.querySelector('#curvature-output').value=`${state.curvature}%`;
  document.querySelector('#grid-summary').textContent=`${state.columns} × ${state.rows} · ${state.columns*state.rows} ячейки`;
  document.querySelector('#rotation-output').textContent=`${Math.round((state.rotation+360)%360)}°`;
  document.querySelector('#position').textContent=`q: ${state.unit.q} · r: ${state.unit.r}`;
  const tiles=[]; const size=state.shape==='hex'?39:53;
  const cells=[];
  const bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(let r=0;r<state.rows;r++) for(let q=0;q<state.columns;q++) {
    const cell=geometry[state.shape](q,r,size); cells.push({q,r,cell});
    cell.points.forEach(([x,y])=>{bounds.minX=Math.min(bounds.minX,cell.x+x); bounds.maxX=Math.max(bounds.maxX,cell.x+x); bounds.minY=Math.min(bounds.minY,cell.y+y); bounds.maxY=Math.max(bounds.maxY,cell.y+y);});
  }
  for(const {q,r,cell} of cells) {
    const h=terrainHeightAt(cell.x,cell.y,bounds), [centerX,centerY]=rotateWorld(cell.x,cell.y,bounds), p=project(...inclinePlane(centerX,centerY,h));
    // Project every shared world-space vertex, rather than merely moving a tile's centre.
    // Neighbouring polygons therefore keep exactly the same edge in top and isometric views.
    const vertices=cell.points.map(([x,y]) => {
      const worldX=cell.x+x, worldY=cell.y+y;
      const vertexH=terrainHeightAt(worldX,worldY,bounds), [rotatedX,rotatedY]=rotateWorld(worldX,worldY,bounds);
      const screen=project(...inclinePlane(rotatedX,rotatedY,vertexH));
      return [screen.x,screen.y];
    });
    const points=vertices.map(([x,y])=>`${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    const center=vertices.reduce(([sumX,sumY],[x,y])=>[sumX+x,sumY+y],[0,0]).map(value=>value/vertices.length);
    tiles.push({q,r,h,p,center,points,vertices});
  }
  const xs=tiles.flatMap(t=>t.vertices.map(([x])=>x)), ys=tiles.flatMap(t=>t.vertices.map(([,y])=>y));
  const rangeX=Math.max(...xs)-Math.min(...xs), rangeY=Math.max(...ys)-Math.min(...ys), padding=28;
  const scale=Math.min((1000-padding*2)/rangeX,(700-padding*2)/rangeY);
  const offsetX=500-(Math.min(...xs)+Math.max(...xs))/2*scale, offsetY=350-(Math.min(...ys)+Math.max(...ys))/2*scale;
  svg.innerHTML = `<g transform="translate(${offsetX} ${offsetY}) scale(${scale})">${tiles.map(t=>`<polygon class="tile" data-q="${t.q}" data-r="${t.r}" points="${t.points}" fill="${color(t.q,t.r,t.h)}" stroke="#5ca6a2" stroke-opacity=".45"/>`).join('')}${state.terrain!=='plain'?tiles.filter(t=>(t.q+t.r)%2===0).map(t=>`<path class="terrain-line" d="M ${t.p.x-12} ${t.p.y} q 12 -8 24 0"/>`).join(''):''}${unitMarkup(tiles.find(t=>t.q===state.unit.q&&t.r===state.unit.r))}</g>`;
}
function unitMarkup(tile) {
  // The marker is anchored to the projected polygon centroid, not its unprojected grid centre.
  const [x,anchorY]=tile.center, y=anchorY-14;
  return `<ellipse class="unit-shadow" cx="${x}" cy="${anchorY}" rx="14" ry="5"/><circle class="unit" cx="${x}" cy="${y}" r="14"/><path class="unit-core" d="M ${x} ${y-7} l 6 7 -6 7 -6-7z"/>`;
}
let drag, suppressClick=false;
svg.addEventListener('contextmenu', (event) => event.preventDefault());
svg.addEventListener('pointerdown', (event) => { if(event.button!==2)return; event.preventDefault(); drag={x:event.clientX,rotation:state.rotation,moved:false}; svg.setPointerCapture(event.pointerId); svg.classList.add('is-rotating'); });
svg.addEventListener('pointermove', (event) => { if(!drag)return; const delta=event.clientX-drag.x; drag.moved ||= Math.abs(delta)>3; state.rotation=drag.rotation+delta*.7; draw(); });
svg.addEventListener('pointerup', (event) => { if(!drag)return; suppressClick=drag.moved; drag=null; svg.classList.remove('is-rotating'); svg.releasePointerCapture(event.pointerId); if(suppressClick)setTimeout(()=>{suppressClick=false;},0); });
svg.addEventListener('click', (event) => { if(suppressClick){suppressClick=false;return;} const tile=event.target.closest('.tile'); if(!tile)return; state.unit={q:+tile.dataset.q,r:+tile.dataset.r}; draw(); });
Object.values(controls).forEach(control=>control.addEventListener('input',draw));
document.querySelector('#reset').addEventListener('click',()=>{state.unit={q:0,r:0};draw();});
draw();
