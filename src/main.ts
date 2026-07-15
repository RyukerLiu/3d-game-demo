import './style.css'
import * as THREE from 'three'

type Phase = 'intro' | 'collect' | 'build' | 'night' | 'ending'
type MaterialKey = 'WOOD' | 'STONE' | 'CLOTH'

declare global {
  interface Window {
    __GAME__: {
      getState: () => { phase: Phase; collected: MaterialKey[]; player: number[] }
      collectAll: () => void
      build: () => void
      enterShelter: () => void
    }
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const objective = document.querySelector<HTMLDivElement>('#objective')!
const inventory = document.querySelector<HTMLDivElement>('#inventory')!
const prompt = document.querySelector<HTMLDivElement>('#prompt')!
const toast = document.querySelector<HTMLDivElement>('#toast')!
const intro = document.querySelector<HTMLDivElement>('#intro')!
const ending = document.querySelector<HTMLDivElement>('#ending')!
const fade = document.querySelector<HTMLDivElement>('#fade')!

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05

const scene = new THREE.Scene()
const dusk = new THREE.Color('#be7056')
const night = new THREE.Color('#07121c')
scene.background = dusk.clone()
scene.fog = new THREE.FogExp2(dusk.clone(), 0.027)

const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 100)
camera.position.set(10, 10, 13)

const hemi = new THREE.HemisphereLight('#ffe0b0', '#314452', 2.7)
scene.add(hemi)
const sun = new THREE.DirectionalLight('#ffd1a0', 4)
sun.position.set(-9, 15, 7)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024)
sun.shadow.camera.left = -22; sun.shadow.camera.right = 22
sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22
scene.add(sun)

const moon = new THREE.DirectionalLight('#8bb8ff', 0)
moon.position.set(8, 13, -5)
scene.add(moon)

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(26, 48),
  new THREE.MeshStandardMaterial({ color: '#536258', roughness: 1, flatShading: true }),
)
ground.rotation.x = -Math.PI / 2
 ground.receiveShadow = true
scene.add(ground)

const ring = new THREE.Mesh(
  new THREE.RingGeometry(25.6, 26.2, 48),
  new THREE.MeshBasicMaterial({ color: '#263c42', transparent: true, opacity: .55, side: THREE.DoubleSide }),
)
ring.rotation.x = -Math.PI / 2; ring.position.y = .01; scene.add(ring)

const mat = (color: string, emissive = '#000000') => new THREE.MeshStandardMaterial({ color, emissive, roughness: .86, flatShading: true })
const trunkMat = mat('#5d4537'), leafMats = [mat('#334d42'), mat('#3e5945'), mat('#4a5f47')]

function mesh(geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, cast = true) {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m
}

// Low-poly perimeter: enough shape to feel authored, never blocks the critical path.
const treeSpots: Array<[number, number, number]> = [
  [-12,-9,1.1],[-16,-1,.9],[-13,8,1.25],[-7,14,.8],[4,15,1.1],[13,10,.85],[16,2,1.2],[14,-8,.95],[8,-15,1.1],[-8,-16,.9],[-18,6,.75],[18,7,.8]
]
treeSpots.forEach(([x,z,s], i) => {
  const trunk = mesh(new THREE.CylinderGeometry(.22*s,.34*s,2.1*s,6), trunkMat,x,1.05*s,z)
  trunk.rotation.y = i*.7
  mesh(new THREE.ConeGeometry(1.25*s,3.1*s,7),leafMats[i%leafMats.length],x,3*s,z)
  mesh(new THREE.ConeGeometry(.92*s,2.4*s,7),leafMats[(i+1)%3],x,4.15*s,z)
})

for (let i=0;i<24;i++) {
  const a = i * 2.399, r = 8 + (i%5)*2.55
  const rock = mesh(new THREE.DodecahedronGeometry(.18 + (i%3)*.11,0), mat(i%2 ? '#768078':'#68746d'), Math.cos(a)*r, .15, Math.sin(a)*r)
  rock.scale.y=.55; rock.rotation.set(i,.4*i,.2*i)
}

// Player: a simple explorer silhouette with a warm chest lamp.
const player = new THREE.Group()
const body = new THREE.Mesh(new THREE.CapsuleGeometry(.35,.75,4,8),mat('#273845')); body.position.y=.86; body.castShadow=true; player.add(body)
const pack = new THREE.Mesh(new THREE.BoxGeometry(.5,.6,.28),mat('#715744')); pack.position.set(0,.88,.3); pack.castShadow=true; player.add(pack)
const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.29,1),mat('#d7a77f')); head.position.y=1.62; head.castShadow=true; player.add(head)
const lamp = new THREE.PointLight('#ffad5f',2.2,5); lamp.position.set(0,1.12,-.36); player.add(lamp)
const lampCore = new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),new THREE.MeshBasicMaterial({color:'#ffd095'})); lampCore.position.copy(lamp.position); player.add(lampCore)
player.position.set(0,0,8); scene.add(player)

const buildAt = new THREE.Vector3(0,0,-6.8)
const buildRing = new THREE.Mesh(new THREE.RingGeometry(2.45,2.62,6),new THREE.MeshBasicMaterial({color:'#ef9b5b',transparent:true,opacity:.5,side:THREE.DoubleSide}))
buildRing.rotation.x=-Math.PI/2; buildRing.rotation.z=Math.PI/6; buildRing.position.copy(buildAt).setY(.035); scene.add(buildRing)
const beacon = new THREE.PointLight('#ff984f',1.7,7); beacon.position.copy(buildAt).setY(.5); scene.add(beacon)

const materialInfo: Record<MaterialKey,{label:string;color:string;pos:THREE.Vector3}> = {
  WOOD:{label:'木材',color:'#c88655',pos:new THREE.Vector3(-7,0,3)},
  STONE:{label:'石材',color:'#aeb7ad',pos:new THREE.Vector3(7,0,1)},
  CLOTH:{label:'布料',color:'#d28b68',pos:new THREE.Vector3(5,0,-7)},
}
const pickups = new Map<MaterialKey,THREE.Group>()

function makePickup(key: MaterialKey) {
  const info=materialInfo[key], g=new THREE.Group(); g.position.copy(info.pos)
  const glow = new THREE.PointLight(info.color,2.2,4); glow.position.y=1; g.add(glow)
  if(key==='WOOD') for(let i=-1;i<=1;i++){const log=new THREE.Mesh(new THREE.CylinderGeometry(.15,.17,1.15,6),mat('#8b5939'));log.rotation.z=Math.PI/2;log.position.set(0,.25+i*.18,0);log.castShadow=true;g.add(log)}
  if(key==='STONE') for(let i=0;i<3;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.32-i*.04,0),mat('#919990'));rock.position.set((i-1)*.34,.22+(i%2)*.18,0);rock.castShadow=true;g.add(rock)}
  if(key==='CLOTH'){const cloth=new THREE.Mesh(new THREE.BoxGeometry(.86,.12,.68),mat('#b86950'));cloth.position.y=.22;cloth.rotation.y=.3;cloth.castShadow=true;g.add(cloth)}
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.7,.035,6,24),new THREE.MeshBasicMaterial({color:info.color,transparent:true,opacity:.7}));halo.rotation.x=Math.PI/2;halo.position.y=.05;g.add(halo)
  scene.add(g); pickups.set(key,g)
}
;(Object.keys(materialInfo) as MaterialKey[]).forEach(makePickup)

const shelter = new THREE.Group(); shelter.position.copy(buildAt); shelter.visible=false; scene.add(shelter)
const wallMat=mat('#526367'), beamMat=mat('#4d342d'), roofMat=mat('#273942')
function part(geo:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,ry=0){const p=new THREE.Mesh(geo,material);p.position.set(x,y,z);p.rotation.y=ry;p.castShadow=true;p.receiveShadow=true;shelter.add(p);return p}
const shelterParts = [
  part(new THREE.BoxGeometry(5,.18,4.3),wallMat,0,.09,0),
  part(new THREE.BoxGeometry(.25,2.7,4.2),wallMat,-2.4,1.35,0),
  part(new THREE.BoxGeometry(.25,2.7,4.2),wallMat,2.4,1.35,0),
  part(new THREE.BoxGeometry(5,2.7,.25),wallMat,0,1.35,-2),
  part(new THREE.BoxGeometry(1.65,2.7,.25),wallMat,-1.65,1.35,2),
  part(new THREE.BoxGeometry(1.65,2.7,.25),wallMat,1.65,1.35,2),
  part(new THREE.ConeGeometry(3.65,1.5,4),roofMat,0,3.3,0,Math.PI/4),
]
;[[-2.25,2], [2.25,2],[-2.25,-2],[2.25,-2]].forEach(([x,z])=>part(new THREE.BoxGeometry(.18,3,.18),beamMat,x,1.5,z))
const terminalScreen=part(new THREE.BoxGeometry(1.15,.72,.08),new THREE.MeshStandardMaterial({color:'#132329',emissive:'#21434b'}),0,1.25,-1.82)
const shelterLight = new THREE.PointLight('#ef9b5b',0,8); shelterLight.position.set(0,1.6,.5); shelter.add(shelterLight)

let phase: Phase='intro'
const collected = new Set<MaterialKey>()
const keys = new Set<string>()
let last=performance.now(), nightMix=0, walkTime=0, storyTimer=0

function updateInventory(){inventory.innerHTML=(Object.keys(materialInfo) as MaterialKey[]).map(k=>`<div class="item ${collected.has(k)?'got':''}">${materialInfo[k].label}</div>`).join('')}
updateInventory()

function setObjective(text:string){objective.textContent=text}
function showToast(text:string){toast.textContent=text;toast.classList.remove('hidden');setTimeout(()=>toast.classList.add('hidden'),1400)}
function collect(key:MaterialKey){
  if(collected.has(key)||phase!=='collect')return
  collected.add(key); const g=pickups.get(key)!; scene.remove(g); updateInventory(); showToast(`取得 ${materialInfo[key].label} · ${collected.size}/3`)
  if(collected.size===3){phase='build';setObjective('材料齊了 — 前往橘色建造點');beacon.intensity=4.5;showToast('材料已齊全')}
}
function collectAll(){(Object.keys(materialInfo) as MaterialKey[]).forEach(collect)}

function buildShelter(){
  if(phase!=='build')return
  shelter.visible=true; shelterParts.forEach((p,i)=>{p.scale.y=.01;setTimeout(()=>{p.scale.y=1},i*105)})
  buildRing.visible=false; beacon.intensity=0
  // Keep the player outside the new walls so entering remains a deliberate final action.
  player.position.z = Math.max(player.position.z, buildAt.z + 3.15)
  phase='night'; setObjective('夜晚降臨 — 走進你剛蓋好的避難所'); showToast('避難所完成')
  shelterLight.intensity=4
}
function enterShelter(){
  if(phase!=='night')return
  player.position.set(0,0,-6.7); phase='ending'; storyTimer=performance.now(); setObjective('收到未知訊號…')
  terminalScreen.material = new THREE.MeshStandardMaterial({color:'#d8e8d6',emissive:'#72e1c2',emissiveIntensity:3})
  fade.style.opacity='.5'; setTimeout(()=>{fade.style.opacity='0';ending.classList.add('visible')},850)
}

function reset(){location.reload()}
document.querySelector('#start')!.addEventListener('click',()=>{intro.classList.remove('visible');phase='collect';setObjective('在入夜前找到 3 份材料');showToast('靠近發光物資即可收集')})
document.querySelector('#restart')!.addEventListener('click',reset)
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e'].includes(k))e.preventDefault();keys.add(k);if(k==='e'&&phase==='build'&&player.position.distanceTo(buildAt)<3.4)buildShelter()})
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()))
addEventListener('blur',()=>keys.clear())
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})

const cameraOffset=new THREE.Vector3(9,9.5,12), cameraTarget=new THREE.Vector3()
function update(dt:number,time:number){
  if(phase!=='intro'&&phase!=='ending'){
    const move=new THREE.Vector3((keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),0,(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0))
    if(move.lengthSq()>0){move.normalize();player.position.addScaledVector(move,5.3*dt);player.position.x=THREE.MathUtils.clamp(player.position.x,-20,20);player.position.z=THREE.MathUtils.clamp(player.position.z,-20,20);player.rotation.y=Math.atan2(move.x,move.z);walkTime+=dt*11;body.position.y=.86+Math.sin(walkTime)*.035}else walkTime=0
    if(phase==='collect') pickups.forEach((g,k)=>{g.rotation.y+=dt*.7;g.position.y=Math.sin(time*.002+g.position.x)*.08;if(player.position.distanceTo(g.position)<1.25)collect(k)})
    if(phase==='build'){
      const near=player.position.distanceTo(buildAt)<3.4;prompt.classList.toggle('hidden',!near);prompt.innerHTML=near?'<b>E</b> 建造避難所':''
    }else prompt.classList.add('hidden')
    if(phase==='night'&&Math.abs(player.position.x)<1.15&&player.position.z<-4.95&&player.position.z>-8.7)enterShelter()
  }
  if(phase==='night'||phase==='ending')nightMix=Math.min(1,nightMix+dt*.22)
  const bg=dusk.clone().lerp(night,nightMix);scene.background=bg;scene.fog!.color.copy(bg);hemi.intensity=2.7-nightMix*2.1;sun.intensity=4-nightMix*3.75;moon.intensity=nightMix*2.2;renderer.toneMappingExposure=1.05-nightMix*.22
  if(phase==='ending'&&performance.now()-storyTimer>500){shelterLight.color.set('#73e3c4');shelterLight.intensity=5+Math.sin(time*.018)*2}
  buildRing.rotation.z+=dt*.16;buildRing.material.opacity=.35+Math.sin(time*.003)*.18
  cameraTarget.copy(player.position).add(cameraOffset);camera.position.lerp(cameraTarget,1-Math.pow(.002,dt));camera.lookAt(player.position.x,1,player.position.z)
}
function animate(time:number){const dt=Math.min((time-last)/1000,.05);last=time;update(dt,time);renderer.render(scene,camera);requestAnimationFrame(animate)}
requestAnimationFrame(animate)

window.__GAME__={
  getState:()=>({phase,collected:[...collected],player:player.position.toArray()}),
  collectAll,
  build:()=>{if(phase==='intro'){intro.classList.remove('visible');phase='collect'}collectAll();buildShelter()},
  enterShelter,
}
