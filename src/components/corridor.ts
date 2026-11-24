import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import type { Collection, Product } from "./types";
import { drawLogo, logoNow } from "@/lib/logo";

/* ---------- rotunda geometry (world units ≈ metres) ---------- */
const R_OUT = 12; // outer wall radius
const R_IN = 7.4; // inner pillar radius
const WALL_H = 3.6;
const CAM_R = 9.7; // walking circle
const EYE = 1.55;
const STEP = 2.5 / 12; // angle between two places (2.5 m along the outer wall)
const INNER_MAX_W = STEP * R_IN - 0.25; // arc available on the pillar per place
const PRINT_H = 1.45;
const LABEL = { w: 512, h: 256 };
const LABEL_H = (0.5 * LABEL.h) / LABEL.w;
const SLOTS = 19; // places rendered at once: 5 behind, 13 ahead (and around the camera)
const BEHIND = 5;
const AHEAD = 0.32; // radians the gaze runs ahead of the walker
const INTRO_WALK = 1.25; // radians walked during the entrance (≈ 6 pieces)
const INTRO_MS = 4200;
const FRAME_DEPTH = 0.07; // how far a framed print stands off the wall
const FRAME_BORDER = 0.055;
const ART_Z = 0.012 + FRAME_DEPTH; // picture surface, measured from the wall
const WALL_LOGO_H = 0.25; // 7TECH logo + slogan painted high on the walls, between every other pair of pieces
const WALL_LOGO_Y = 2.95;
/** section signs: a landscape board hung on two chains over the walkway where each collection starts */
const SIGN = { w: 2.0, h: 0.5, y: 2.5, d: 0.04, chainX: 0.8 };
const SIGN_POOL = 6;
const SECTION_GAP = 2; // empty places between two collections; the sign hangs in the middle of the gap
const WALL_LOGO_COLOR = "#7d786f";

/** dark gallery: the walls sit in shadow, every piece gets its own round spotlight from above */
export const THEME = {
  bg: "#0d0e10",
  floor: "#19191a",
  ceiling: "#161615",
  inner: "#2a2926",
  outer: "#302f2c",
  lamp: 0.9, // light thrown on the wall
  beam: 0.07, // faint haze in the cone, barely there like in a real room
};

type Place = {
  col: number;
  outer: Product | null; // null: bare wall in the gap between collections
  inner: Product | null;
  /** first place of its collection: the hanging section sign sits just before it */
  first: boolean;
};

export type Fonts = { body: string; display: string; brand: string };
export type Tip = "look" | "print" | "collection" | null;

export type CorridorEvents = {
  onCollection: (col: number) => void;
  /** the product in focus (null when nothing is) */
  onFocus: (p: Product | null, collection: string) => void;
  /** share of the pieces in view that have loaded, while the entrance waits */
  onProgress: (share: number) => void;
  onTip: (tip: Tip) => void;
  onShown: () => void;
  onLanding: () => void;
};

const mod = (n: number, m: number) => ((n % m) + m) % m;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export class Corridor {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(0, 0);
  private pointerIn = false;
  private raf = 0;
  private last = performance.now();
  private t0 = performance.now();
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  private places: Place[] = [];
  private loader = new THREE.TextureLoader();
  private prints = new Map<string, THREE.Texture>();
  private labels = new Map<string, THREE.Texture>();
  private plaques: THREE.Texture[] = [];
  private signs: { grp: THREE.Group; swing: THREE.Group; faces: THREE.Mesh[]; mat: THREE.MeshBasicMaterial }[] = [];
  private glow?: THREE.Texture;

  private mats: ReturnType<Corridor["makeMaterials"]>;
  private outerGroups: THREE.Group[] = [];
  private outerArt: THREE.Mesh[] = [];
  private outerLabel: THREE.Mesh[] = [];
  private innerGroups: THREE.Group[] = [];
  private outerLogos: THREE.Mesh[] = [];
  private innerLogos: THREE.Mesh[] = [];
  private innerArt: THREE.Mesh[] = [];
  private innerLabel: THREE.Mesh[] = [];
  private slotIndex: number[] = new Array(SLOTS).fill(0);
  private clickables: THREE.Mesh[] = [];

  /** walking state: `at` eases toward `target`; `moved` = last time the visitor moved */
  private walk = { at: -0.2, target: -0.2, moved: 0 };
  private intro = { phase: "wait" as "wait" | "run" | "done", at: 0, from: 0, to: 0 };
  private allVisibleLoaded = false;
  private focus: THREE.Mesh | null = null;
  private focusAt = 0;
  private lastFocused: THREE.Mesh | null = null;
  private lastProgress = -1;
  /** a piece to focus once the walk reaches it (search → fly to product) */
  private pending: { r: number; side: "outer" | "inner" } | null = null;
  private col = -1;
  private tip: Tip = null;

  private camPos: THREE.Vector3 | null = null;
  private camLook: THREE.Vector3 | null = null;
  private v = {
    walkPos: new THREE.Vector3(),
    walkLook: new THREE.Vector3(),
    wantPos: new THREE.Vector3(),
    wantLook: new THREE.Vector3(),
    dir: new THREE.Vector3(),
  };

  private cleanup: (() => void)[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private collections: Collection[],
    private fonts: Fonts,
    private ev: CorridorEvents,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 60);
    this.camera.position.set(0, EYE, CAM_R);

    const bg = new THREE.Color(THEME.bg);
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg, 7, 22);

    this.buildPlaces();
    this.mats = this.makeMaterials();
    this.buildRoom();
    this.buildSlots();
    this.buildWallLogos();
    this.buildSigns();
    this.plaques = collections.map((c) => this.plaqueTexture(c.title));
    for (const pl of this.places) {
      if (pl.outer) this.print(pl.outer.img);
      if (pl.inner) this.print(pl.inner.img);
    }

    this.resize();
    this.bind();
    this.loop();
  }

  /* ---------------- data ---------------- */

  /**
   * Per collection: prints on the outer wall with the rest of the collection hung opposite
   * on the pillar, so both sides are full. A sign hung from the ceiling marks where it starts.
   */
  private buildPlaces() {
    this.collections.forEach((c, ci) => {
      const prints = c.items.slice(0, 10);
      const nOuter = Math.ceil(prints.length / 2);
      const outer = prints.slice(0, nOuter);
      const inner = prints.slice(nOuter);
      for (let k = 0; k < SECTION_GAP; k++) this.places.push({ col: ci, outer: null, inner: null, first: false });
      outer.forEach((o, i) => this.places.push({ col: ci, outer: o, inner: inner[i] ?? null, first: i === 0 }));
    });
  }

  /* ---------------- textures ---------------- */

  private print(src: string) {
    const url = "/" + src.replace(/^\//, "");
    const cached = this.prints.get(url);
    if (cached) return cached;
    // product shots come with transparent backgrounds: flatten them onto white paper
    const cv = document.createElement("canvas");
    cv.width = cv.height = 768;
    const flat = new THREE.CanvasTexture(cv);
    flat.colorSpace = THREE.SRGBColorSpace;
    flat.anisotropy = 4;
    flat.userData.ready = false;
    this.loader.load(url, (t) => {
      const im = t.image as HTMLImageElement;
      const x = cv.getContext("2d")!;
      x.fillStyle = "#ffffff";
      x.fillRect(0, 0, 768, 768);
      const s = Math.min(768 / im.width, 768 / im.height) * 0.94;
      x.drawImage(im, (768 - im.width * s) / 2, (768 - im.height * s) / 2, im.width * s, im.height * s);
      t.dispose();
      flat.needsUpdate = true;
      flat.userData.ready = true;
    });
    this.prints.set(url, flat);
    return flat;
  }

  private label(p: Product, collection: string) {
    const key = `${p.id}`;
    const cached = this.labels.get(key);
    if (cached) return cached;
    const { w, h } = LABEL;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const x = cv.getContext("2d")!;
    x.fillStyle = "#f7f6f2";
    x.fillRect(0, 0, w, h);
    x.fillStyle = "#1a1a1a";
    x.textBaseline = "top";
    const fit = (s: string) => {
      let t = s;
      while (t.length > 1 && x.measureText(t).width > w - 60) t = t.slice(0, -1);
      return t === s ? t : `${t.trimEnd()}…`;
    };
    const logo = logoNow("#1a1a1a");
    if (logo) drawLogo(x, logo, 30, 34, 46);
    x.font = `italic 400 52px ${this.fonts.body}`;
    x.fillText(fit(p.title), 30, 104);
    x.font = "400 26px ui-monospace, Menlo, monospace";
    x.globalAlpha = 0.6;
    x.fillText(fit(collection.toUpperCase()), 30, h - 30 - 26);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.labels.set(key, tex);
    return tex;
  }

  /** landscape sign face: collection title centred, a small black 7TECH logo in the top-left corner */
  private plaqueTexture(title: string) {
    const W = 1536;
    const H = Math.round((W * SIGN.h) / SIGN.w);
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const x = cv.getContext("2d")!;
    x.fillStyle = "#fbfaf6"; // backlit panel
    x.fillRect(0, 0, W, H);
    const logo = logoNow("#1a1a1a");
    if (logo) drawLogo(x, logo, 44, 36, 40);
    // the title takes one line, shrunk to fit
    const t = title.toUpperCase();
    let size = 170;
    x.font = `400 ${size}px ${this.fonts.display}`;
    const room = W - 2 * 150;
    const tw = x.measureText(t).width;
    if (tw > room) size = Math.floor((size * room) / tw);
    x.font = `400 ${size}px ${this.fonts.display}`;
    x.fillStyle = "#1a1a1a";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(t, W / 2, H / 2 + 22 + size * 0.04);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  /** a short chain of alternating links from the ceiling down to the sign */
  private chain(len: number, mat: THREE.Material) {
    const g = new THREE.Group();
    const geo = (this.linkGeo ??= new THREE.TorusGeometry(0.016, 0.0045, 6, 14));
    const pitch = 0.026;
    const n = Math.ceil(len / pitch);
    for (let i = 0; i < n; i++) {
      const l = new THREE.Mesh(geo, mat);
      l.scale.set(0.75, 1.25, 1); // oval links
      l.position.y = -i * pitch - 0.016;
      l.rotation.y = i % 2 ? Math.PI / 2 : 0;
      g.add(l);
    }
    return g;
  }
  private linkGeo?: THREE.TorusGeometry;

  private buildSigns() {
    const m = this.mats;
    const board = new THREE.BoxGeometry(SIGN.w + 0.04, SIGN.h + 0.04, SIGN.d);
    const face = new THREE.PlaneGeometry(SIGN.w, SIGN.h);
    const boardMat = new THREE.MeshStandardMaterial({ color: "#1e1d1b", roughness: 0.55, metalness: 0.15 });
    const hang = WALL_H - SIGN.y; // ceiling → board centre
    const chainLen = hang - SIGN.h / 2 - 0.02;
    for (let i = 0; i < SIGN_POOL; i++) {
      const grp = new THREE.Group();
      // the board swings gently from the ceiling; the chains swing with it
      const swing = new THREE.Group();
      swing.position.y = WALL_H;
      const content = new THREE.Group();
      content.position.y = -hang;
      swing.add(content);
      grp.add(swing);
      const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
      content.add(new THREE.Mesh(board, boardMat));
      // a face on both sides, so it reads from either direction of travel
      const faces = [0, Math.PI].map((ry) => {
        const f = new THREE.Mesh(face, mat);
        f.rotation.y = ry;
        f.position.z = (ry ? -1 : 1) * (SIGN.d / 2 + 0.002);
        content.add(f);
        return f;
      });
      for (const sx of [-SIGN.chainX, SIGN.chainX]) {
        const c = this.chain(chainLen, m.fixture);
        c.position.set(sx, hang, 0);
        content.add(c);
        const plate = new THREE.Mesh(this.fixtureGeo.canopy, m.fixture); // ceiling plate
        plate.position.set(sx, WALL_H - 0.012, 0);
        grp.add(plate);
      }
      grp.visible = false;
      this.scene.add(grp);
      this.signs.push({ grp, swing, faces, mat });
    }
  }

  private glowTexture() {
    if (this.glow) return this.glow;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const x = cv.getContext("2d")!;
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return (this.glow = new THREE.CanvasTexture(cv));
  }

  private spot?: THREE.Texture;
  /**
   * Footprint of a ceiling spot on a vertical wall: an ellipse stretched downward,
   * brightest near the top where the beam is closest, with a soft wide falloff around it.
   */
  private spotTexture() {
    if (this.spot) return this.spot;
    const W = 512;
    const H = 768;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const x = cv.getContext("2d")!;
    // wide, very soft wash
    x.save();
    x.translate(W / 2, H * 0.5);
    x.scale(1, 1.35);
    let g = x.createRadialGradient(0, 0, 0, 0, 0, W / 2);
    g.addColorStop(0, "rgba(255,255,255,0.34)");
    g.addColorStop(0.6, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(-W, -H, W * 2, H * 2);
    x.restore();
    // the beam's ellipse, hot spot pushed up toward the fixture
    x.save();
    x.translate(W / 2, H * 0.5);
    x.scale(1, 1.42);
    g = x.createRadialGradient(0, -12, 0, 0, 0, W * 0.36);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.55, "rgba(255,255,255,0.62)");
    g.addColorStop(0.85, "rgba(255,255,255,0.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(-W, -H, W * 2, H * 2);
    x.restore();
    return (this.spot = new THREE.CanvasTexture(cv));
  }

  private beam?: THREE.Texture;
  /** light cone from the fixture: narrow and bright at the top, wide and fading at the bottom */
  private beamTexture() {
    if (this.beam) return this.beam;
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 512;
    const x = cv.getContext("2d")!;
    x.filter = "blur(10px)";
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.5, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(108, 10);
    x.lineTo(148, 10);
    x.lineTo(240, 500);
    x.lineTo(16, 500);
    x.closePath();
    x.fill();
    return (this.beam = new THREE.CanvasTexture(cv));
  }

  private lampMaterial(color: string, opacity: number, map?: THREE.Texture) {
    return new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      fog: true,
      map: map ?? this.glowTexture(),
      opacity,
      toneMapped: false,
      transparent: true,
    });
  }

  /* ---------------- scene ---------------- */

  private makeMaterials() {
    // prints read as lit paper, a touch under pure white so they don't glare in the dark room
    const basic = (color = "#e6e2da") => () => new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const frame = () => new THREE.MeshStandardMaterial({ color: "#1e1d1b", roughness: 0.55, metalness: 0.15 });
    const innerLamp = this.lampMaterial("#ffdcae", THEME.lamp, this.spotTexture());
    innerLamp.userData.full = THEME.lamp;
    const innerBeam = this.lampMaterial("#ffe9c8", THEME.beam, this.beamTexture());
    innerBeam.userData.full = THEME.beam;
    return {
      floor: new THREE.MeshBasicMaterial({ color: THEME.floor, toneMapped: false, transparent: true, opacity: 0.93 }),
      ceiling: new THREE.MeshBasicMaterial({ color: THEME.ceiling, toneMapped: false }),
      outerWall: new THREE.MeshBasicMaterial({ color: THEME.outer, side: THREE.BackSide, toneMapped: false }),
      innerWall: new THREE.MeshBasicMaterial({ color: THEME.inner, side: THREE.FrontSide, toneMapped: false }),
      lamp: this.lampMaterial("#ffdcae", THEME.lamp, this.spotTexture()),
      innerLamp,
      beam: this.lampMaterial("#ffe9c8", THEME.beam, this.beamTexture()),
      innerBeam,
      fixture: new THREE.MeshStandardMaterial({ color: "#151514", roughness: 0.4, metalness: 0.6 }),
      bulb: new THREE.MeshBasicMaterial({ color: "#fff6e6", toneMapped: false }),
      outer: Array.from({ length: SLOTS }, basic("#e6e2da")),
      inner: Array.from({ length: SLOTS }, basic("#e0dcd4")),
      outerLabel: Array.from({ length: SLOTS }, basic("#cfcbc3")),
      innerLabel: Array.from({ length: SLOTS }, basic("#c9c5bd")),
      outerFrame: Array.from({ length: SLOTS }, frame),
      innerFrame: Array.from({ length: SLOTS }, frame),
      outerLogo: null as THREE.MeshBasicMaterial | null,
      innerLogo: null as THREE.MeshBasicMaterial | null,
      shadow: new THREE.MeshBasicMaterial({
        map: this.shadowTexture(),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.55,
      }),
      innerShadow: new THREE.MeshBasicMaterial({
        map: this.shadowTexture(),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.55,
      }),
    };
  }

  private shadowTex?: THREE.Texture;
  /** blurred rectangle covering the middle 62.5% of the texture */
  private shadowTexture() {
    if (this.shadowTex) return this.shadowTex;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const x = cv.getContext("2d")!;
    x.filter = "blur(16px)";
    x.fillStyle = "rgba(40,36,30,0.85)";
    x.fillRect(48, 48, 160, 160);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return (this.shadowTex = t);
  }

  /** turns a flat picture plane into a framed object: moulding box behind it and a cast shadow on the wall */
  private dress(art: THREE.Mesh, frameMat: THREE.Material, shadowMat: THREE.Material) {
    const box = new THREE.Mesh(this.boxGeo, frameMat);
    const shadow = new THREE.Mesh(this.unitGeo, shadowMat);
    art.add(box, shadow);
    art.userData.box = box;
    art.userData.shadow = shadow;
    art.userData.lift = 0;
  }

  /** sizes the frame children for a picture of w × h metres (art is scaled to w × h) */
  private fit(art: THREE.Mesh, w: number, h: number, border: number) {
    const box = art.userData.box as THREE.Mesh;
    const sh = art.userData.shadow as THREE.Mesh;
    box.scale.set(1 + (2 * border) / w, 1 + (2 * border) / h, FRAME_DEPTH);
    box.position.z = -FRAME_DEPTH / 2 - 0.002;
    const fw = w + 2 * border;
    const fh = h + 2 * border;
    sh.scale.set((fw + 0.06) / 0.625 / w, (fh + 0.06) / 0.625 / h, 1);
    sh.position.set(0.03 / w, -0.07 / h, -ART_Z - art.userData.lift + 0.004);
  }

  /** the focused frame eases a few centimetres off the wall */
  private lift(art: THREE.Mesh, dt: number) {
    const want = art === this.focus ? 0.06 : 0;
    const cur = art.userData.lift as number;
    const next = cur + (want - cur) * Math.min(1, dt * 8);
    art.userData.lift = next;
    art.position.z = ART_Z + next;
  }

  private unitGeo = new THREE.PlaneGeometry(1, 1);
  private boxGeo = new THREE.BoxGeometry(1, 1, 1);

  private fixtureGeo = {
    stem: new THREE.CylinderGeometry(0.012, 0.012, 1, 8),
    canopy: new THREE.CylinderGeometry(0.06, 0.06, 0.025, 20),
    head: new THREE.CylinderGeometry(0.075, 0.1, 0.22, 24, 1, true),
    cap: new THREE.CircleGeometry(0.075, 24),
    bulb: new THREE.CircleGeometry(0.088, 24),
  };

  /**
   * Ceiling-hung spotlight `out` metres in front of the wall, its can aimed at the piece's centre.
   * Returns the group plus the beam's start point and tilt so the light cone can follow the same line.
   */
  private fixture(out: number, aimY: number) {
    const m = this.mats;
    const f = this.fixtureGeo;
    const grp = new THREE.Group();
    const drop = 0.26; // stem length below the ceiling
    const hy = WALL_H - drop - 0.06; // head pivot
    const canopy = new THREE.Mesh(f.canopy, m.fixture);
    canopy.position.set(0, WALL_H - 0.012, out);
    const stem = new THREE.Mesh(f.stem, m.fixture);
    stem.scale.y = drop;
    stem.position.set(0, WALL_H - drop / 2, out);
    // aim: rotate the can about x so its open end (-y) points at (0, aimY, ART_Z)
    const dy = hy - aimY;
    const dz = out - ART_Z;
    const tilt = Math.atan2(dz, dy);
    const head = new THREE.Group();
    head.position.set(0, hy, out);
    head.rotation.x = tilt;
    const can = new THREE.Mesh(f.head, m.fixture);
    const cap = new THREE.Mesh(f.cap, m.fixture);
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = 0.11;
    const bulb = new THREE.Mesh(f.bulb, m.bulb);
    bulb.rotation.x = Math.PI / 2;
    bulb.position.y = -0.109;
    head.add(can, cap, bulb);
    grp.add(canopy, stem, head);
    return { grp, hy, out, tilt, len: Math.hypot(dy, dz) };
  }

  /** light cone laid along the fixture's aim line, from the bulb down to just above the piece */
  private beamMesh(fx: { hy: number; out: number; tilt: number; len: number }, mat: THREE.Material) {
    const len = fx.len * 0.82;
    const mesh = new THREE.Mesh(this.beamGeo, mat);
    mesh.scale.set(1, len, 1);
    // midpoint along the aim line
    const k = 0.12 + len / 2;
    mesh.position.set(0, fx.hy - Math.cos(fx.tilt) * k, fx.out - Math.sin(fx.tilt) * k);
    mesh.rotation.x = fx.tilt;
    return mesh;
  }
  private beamGeo = new THREE.PlaneGeometry(1.5, 1);

  private buildRoom() {
    const m = this.mats;
    const floorGeo = new THREE.RingGeometry(7.2, 12.2, 160);
    const floor = new THREE.Mesh(floorGeo, m.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    // polished floor: a mirror underneath, seen through the dark floor as a soft, dim reflection
    const dpr = Math.min(window.devicePixelRatio, 2);
    const mirror = new Reflector(floorGeo, {
      textureWidth: Math.round(window.innerWidth * dpr * 0.3),
      textureHeight: Math.round(window.innerHeight * dpr * 0.3),
      color: 0x8a8a8a,
    });
    mirror.rotation.x = -Math.PI / 2;
    this.scene.add(mirror);
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(R_OUT, R_OUT, WALL_H, 160, 1, true), m.outerWall);
    outer.position.y = WALL_H / 2;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R_IN, R_IN, WALL_H, 120, 1, true), m.innerWall);
    inner.position.y = WALL_H / 2;
    const ceiling = new THREE.Mesh(new THREE.RingGeometry(7.2, 12.2, 160), m.ceiling);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_H;
    this.scene.add(ceiling);
    // only the frames are lit materials; walls and prints stay flat-shaded like paper under gallery light
    this.scene.add(new THREE.HemisphereLight("#fff3e0", "#1a1916", 0.9));
    const centre = new THREE.PointLight("#fff0da", 0.7, 0, 0);
    centre.position.set(0, 3.3, 0);
    this.scene.add(centre);
    const top = new THREE.DirectionalLight("#ffe9c9", 2.2);
    top.position.set(0, 1, 0);
    this.scene.add(top);
    for (const o of [floor, outer, inner]) {
      o.userData.background = true;
      this.scene.add(o);
      this.clickables.push(o);
    }
  }

  /** logo + "Kelajak. Bugun" drawn once in the brand face (white, tinted by the material) */
  private wallDecalTexture() {
    const H = 160;
    const logoH = 88;
    const cv = document.createElement("canvas");
    const x = cv.getContext("2d")!;
    const font = `700 76px ${this.fonts.brand}`;
    x.font = font;
    const text = "KELAJAK. BUGUN.";
    const tw = x.measureText(text).width;
    const logoW = (logoH * 168) / 36;
    const gap = 44;
    cv.width = Math.ceil(logoW + gap * 2 + 3 + tw + 16);
    cv.height = H;
    x.fillStyle = "#ffffff";
    const img = logoNow("#ffffff");
    if (img) drawLogo(x, img, 8, (H - logoH) / 2, logoH);
    x.fillRect(8 + logoW + gap, H / 2 - 44, 3, 88); // thin divider
    x.font = font;
    x.textBaseline = "middle";
    x.fillText(text, 8 + logoW + gap * 2 + 3, H / 2 + 3);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return { tex: t, aspect: cv.width / cv.height };
  }

  /** a strip bent to radius r (so a wide decal hugs the curved wall); `dir` makes the text read left→right */
  private wallStrip(w: number, h: number, r: number, dir: 1 | -1) {
    const geo = new THREE.PlaneGeometry(w, h, 32, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const th = (dir * pos.getX(i)) / r;
      pos.setXYZ(i, r * Math.sin(th), pos.getY(i), r * Math.cos(th));
    }
    geo.computeBoundingSphere();
    return geo;
  }

  /** decals on the upper walls; positioned per frame with the recycled slots */
  private buildWallLogos() {
    const { tex, aspect } = this.wallDecalTexture();
    const w = WALL_LOGO_H * aspect;
    // seen from inside, text on the outer wall runs toward -x; on the pillar toward +x
    const outerGeo = this.wallStrip(w, WALL_LOGO_H, R_OUT - 0.02, -1);
    const innerGeo = this.wallStrip(w, WALL_LOGO_H, R_IN + 0.02, 1);
    const mat = () =>
      new THREE.MeshBasicMaterial({
        map: tex,
        color: WALL_LOGO_COLOR,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
    this.mats.outerLogo = mat();
    this.mats.innerLogo = mat();
    for (let i = 0; i < SLOTS; i++) {
      const o = new THREE.Mesh(outerGeo, this.mats.outerLogo);
      const n = new THREE.Mesh(innerGeo, this.mats.innerLogo);
      o.position.y = n.position.y = WALL_LOGO_Y;
      this.outerLogos.push(o);
      this.innerLogos.push(n);
      this.scene.add(o, n);
    }
  }

  private buildSlots() {
    const m = this.mats;
    const unit = new THREE.PlaneGeometry(1, 1);
    const labelGeo = new THREE.PlaneGeometry(0.5, LABEL_H);
    const lampGeo = new THREE.PlaneGeometry(2.5, 3.2);
    const innerLampGeo = new THREE.PlaneGeometry(2.2, 2.85);
    for (let i = 0; i < SLOTS; i++) {
      // outer wall
      const g = new THREE.Group();
      const lamp = new THREE.Mesh(lampGeo, m.lamp);
      lamp.position.set(0, 1.5, 0.01);
      const fx = this.fixture(0.95, 1.65);
      g.add(fx.grp, this.beamMesh(fx, m.beam));
      const art = new THREE.Mesh(unit, m.outer[i]);
      art.position.set(0, 1.6, ART_Z);
      this.dress(art, m.outerFrame[i], m.shadow);
      Object.assign(art.userData, { side: "outer", slot: i });
      const label = new THREE.Mesh(labelGeo, m.outerLabel[i]);
      label.visible = false;
      g.add(lamp, art, label);
      this.scene.add(g);
      this.outerGroups.push(g);
      this.outerArt.push(art);
      this.outerLabel.push(label);
      this.clickables.push(art);

      // inner pillar
      const gi = new THREE.Group();
      const ilamp = new THREE.Mesh(innerLampGeo, m.innerLamp);
      ilamp.position.set(0, 1.5, 0.01);
      ilamp.renderOrder = 1;
      const ifx = this.fixture(0.95, 1.65);
      const ibeam = this.beamMesh(ifx, m.innerBeam);
      ibeam.renderOrder = 1;
      gi.add(ifx.grp, ibeam);
      const iart = new THREE.Mesh(unit, m.inner[i]);
      iart.position.set(0, 1.6, ART_Z);
      this.dress(iart, m.innerFrame[i], m.innerShadow);
      iart.renderOrder = 2;
      Object.assign(iart.userData, { side: "inner", slot: i });
      const ilabel = new THREE.Mesh(labelGeo, m.innerLabel[i]);
      ilabel.renderOrder = 2;
      ilabel.visible = false;
      gi.add(ilamp, iart, ilabel);
      this.scene.add(gi);
      this.innerGroups.push(gi);
      this.innerArt.push(iart);
      this.innerLabel.push(ilabel);
      this.clickables.push(iart);
    }
  }

  private placeLabel(mesh: THREE.Mesh, mat: THREE.MeshBasicMaterial, tex: THREE.Texture | null, w: number, h: number) {
    mesh.visible = !!tex;
    mesh.position.set(-w / 2 + 0.25, 1.6 - h / 2 - 0.1 - LABEL_H / 2, 0.03);
    if (mat.map !== tex) {
      mat.map = tex;
      mat.needsUpdate = true;
    }
  }

  private setMap(mat: THREE.MeshBasicMaterial, tex: THREE.Texture | null) {
    if (mat.map !== tex) {
      mat.map = tex;
      mat.needsUpdate = true;
    }
  }

  private setOpacity(mat: THREE.MeshBasicMaterial, o: number) {
    mat.opacity = o;
    const tr = o < 1;
    if (mat.transparent !== tr) {
      mat.transparent = tr;
      mat.needsUpdate = true;
    }
  }

  /* ---------------- public API ---------------- */

  /** the absolute place index ≡ i (mod places) nearest to where the walker is heading */
  private nearest(i: number) {
    const P = this.places.length;
    const cur = Math.round(this.walk.target / STEP);
    return cur + (mod(i - cur + P / 2, P) - P / 2);
  }

  /** walk to a product and bring it up close */
  goToProduct(id: number) {
    const i = this.places.findIndex((pl) => pl.outer?.id === id || pl.inner?.id === id);
    if (i < 0) return;
    const side = this.places[i].outer?.id === id ? "outer" : "inner";
    const r = this.nearest(i);
    this.walk.target = (r - 1.5) * STEP;
    this.walk.moved = performance.now();
    this.focus = null;
    this.pending = { r, side };
  }

  /** step back from the piece in focus */
  unfocus() {
    this.release();
    this.pending = null;
  }

  /**
   * Leave the close-up a step back, right where the piece hangs, instead of gliding back
   * to wherever the walk was before: the walker is re-placed so its gaze lands on the piece.
   */
  private release() {
    const f = this.focus;
    if (!f) return;
    this.focus = null;
    const a = this.slotIndex[f.userData.slot as number] * STEP - AHEAD * 0.85;
    this.walk.at = this.walk.target = a;
  }

  /** jump to the previous / next collection */
  stepCollection(d: number) {
    const P = this.places.length;
    let r = Math.round(this.walk.target / STEP);
    const c = this.places[mod(r, P)].col;
    if (d > 0) while (this.places[mod(r, P)].col === c) r++;
    else {
      while (this.places[mod(r, P)].col === c) r--;
      const prev = this.places[mod(r, P)].col;
      while (this.places[mod(r - 1, P)].col === prev) r--;
    }
    this.walk.target = r * STEP - 0.3;
    this.walk.moved = performance.now();
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // portrait screens: widen the vertical field so the sideways view stays close to the desktop one
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(62 / 2)) * Math.max(w / h, 1.2));
    const vfov = 2 * Math.atan(Math.tan(hfov / 2) / (w / h));
    this.camera.fov = Math.min(THREE.MathUtils.radToDeg(vfov), 88);
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
    for (const t of [...this.prints.values(), ...this.labels.values(), ...this.plaques]) t.dispose();
    this.glow?.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      (mesh.material as THREE.Material | undefined)?.dispose();
    });
    this.renderer.dispose();
  }

  /* ---------------- input ---------------- */

  private bind() {
    const c = this.canvas;
    const host = c.parentElement ?? c;
    const add = (t: EventTarget, type: string, fn: EventListener, opt?: AddEventListenerOptions) => {
      t.addEventListener(type, fn, opt);
      this.cleanup.push(() => t.removeEventListener(type, fn, opt));
    };
    const w = this.walk;
    let drag: { id: number; t: number; v: number; x: number; y: number } | null = null;
    let dragged = false;
    const setPointer = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };

    add(
      host,
      "wheel",
      ((e: WheelEvent) => {
        e.preventDefault();
        const d = e.deltaMode === 1 ? (e.deltaY + e.deltaX) * 16 : e.deltaY + e.deltaX;
        w.target += 9e-4 * Math.max(-120, Math.min(120, d));
        w.moved = performance.now();
      }) as EventListener,
      { passive: false },
    );

    add(host, "pointerdown", ((e: PointerEvent) => {
      if (drag) return;
      drag = { id: e.pointerId, t: e.timeStamp, v: 0, x: e.clientX, y: e.clientY };
      dragged = false;
    }) as EventListener);

    add(host, "pointermove", ((e: PointerEvent) => {
      setPointer(e);
      this.pointerIn = e.pointerType === "mouse";
      if (drag && e.pointerType === "mouse" && e.buttons === 0) drag = null; // missed pointerup
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      const l = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      if (Math.abs(l) > 3) {
        dragged = true;
        w.moved = performance.now();
      }
      w.target -= 0.0022 * l;
      const dt = Math.max(1, e.timeStamp - drag.t);
      drag.v = 0.6 * drag.v + (l / dt) * 0.4;
      drag.t = e.timeStamp;
      drag.x = e.clientX;
      drag.y = e.clientY;
    }) as EventListener);

    add(host, "pointerup", ((e: PointerEvent) => {
      const d = drag;
      if (!d || d.id !== e.pointerId) return;
      drag = null;
      if (dragged && !(e.timeStamp - d.t > 80)) {
        w.target -= 220 * Math.max(-3, Math.min(3, d.v)) * 0.0022;
        w.moved = performance.now();
      }
    }) as EventListener);
    add(host, "pointercancel", (() => (drag = null)) as EventListener);
    add(host, "pointerleave", ((e: PointerEvent) => {
      if (e.pointerType === "mouse") drag = null;
      this.pointerIn = false;
    }) as EventListener);

    add(c, "click", ((e: MouseEvent) => {
      if (dragged) return;
      setPointer(e);
      const hit = this.pick();
      if (!hit || hit.userData.background) {
        this.release();
        return;
      }
      if (this.focus !== hit) {
        this.focus = hit;
        this.focusAt = performance.now();
        return;
      }
      this.release(); // clicking the piece in focus steps back from it
    }) as EventListener);

    add(window, "keydown", ((e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") this.release();
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowUp") w.target += 2 * STEP;
      if (e.key === "ArrowLeft") w.target -= 2 * STEP;
      if (e.key.startsWith("Arrow")) w.moved = performance.now();
    }) as EventListener);

    add(window, "resize", (() => this.resize()) as EventListener);
  }

  private pick(): THREE.Mesh | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const h of this.raycaster.intersectObjects(this.clickables, false)) {
      const o = h.object as THREE.Mesh;
      if (!o.visible || !o.parent?.visible) continue;
      const mat = o.material as THREE.MeshBasicMaterial;
      if (mat.transparent && mat.opacity < 0.5) continue; // faded-out pillar
      if (!o.userData.background && !mat.map) continue;
      return o;
    }
    return null;
  }

  private placeOf(obj: THREE.Mesh) {
    return this.places[mod(this.slotIndex[obj.userData.slot as number], this.places.length)];
  }

  /* ---------------- frame loop ---------------- */

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    const elapsed = (now - this.t0) / 1000;
    const w = this.walk;
    const q = this.reduced;
    const intro = this.intro;
    const m = this.mats;

    if (this.focus && w.moved > this.focusAt) this.focus = null;

    // intro: start a few pieces back along the corridor and stroll forward to the first collection
    if (intro.phase === "wait" && !intro.at) {
      intro.at = now;
      intro.to = w.target;
      intro.from = intro.to - INTRO_WALK;
    }
    if (intro.phase !== "done" && (q || w.moved > intro.at)) {
      if (!q) w.target = w.at + (w.target - intro.to);
      if (intro.phase === "wait") this.ev.onShown();
      intro.phase = "done";
      this.ev.onLanding();
    }
    if (intro.phase === "wait") {
      w.at = intro.from;
      if (this.allVisibleLoaded || now - intro.at > 6000) {
        intro.phase = "run";
        intro.at = now;
        this.ev.onShown();
      }
    } else if (intro.phase === "run") {
      const e = Math.min(1, (now - intro.at) / INTRO_MS);
      w.at = intro.from + (intro.to - intro.from) * easeOutCubic(e);
      if (e >= 0.8) this.ev.onLanding();
      if (e >= 1) {
        intro.phase = "done";
        w.target = intro.to;
      }
    } else {
      if (!this.focus && !q) w.target += 0.03 * dt * 0.25; // slow idle drift
      w.at += (w.target - w.at) * Math.min(1, 2.4 * dt);
    }

    const a = w.at;
    const V = this.v;
    V.walkPos.set(CAM_R * Math.sin(a), EYE + (q ? 0 : 0.012 * Math.sin(1.4 * elapsed)), CAM_R * Math.cos(a));
    const px = this.pointerIn ? this.pointer.x : 0;
    const py = this.pointerIn ? this.pointer.y : 0;
    const c = a + AHEAD + 0.25 * px;
    V.walkLook.set(CAM_R * Math.sin(c), 1.5 + 0.25 * py, CAM_R * Math.cos(c));

    if (this.focus) {
      this.focus.getWorldPosition(V.wantLook);
      this.focus.getWorldDirection(V.dir);
      V.wantPos.copy(V.wantLook).addScaledVector(V.dir, 2.2);
      V.wantLook.y -= 0.3;
    } else {
      V.wantLook.copy(V.walkLook);
      V.wantPos.copy(V.walkPos);
    }
    if (!this.camPos) this.camPos = V.walkPos.clone();
    if (!this.camLook) this.camLook = V.walkLook.clone();

    if (intro.phase !== "done") {
      // the intro walk is already eased, so the camera rides the ring exactly
      this.camPos.copy(V.walkPos);
      this.camLook.copy(V.walkLook);
    } else {
      const k = Math.min(1, dt * (q ? 20 : 2.8));
      // move along the ring (angle + radius), not in a straight line: a straight chord
      // between far-apart ring points cuts through the pillar when scrolling fast
      const ca = Math.atan2(this.camPos.x, this.camPos.z);
      const cr = Math.hypot(this.camPos.x, this.camPos.z);
      const ta = Math.atan2(V.wantPos.x, V.wantPos.z);
      const tr = Math.hypot(V.wantPos.x, V.wantPos.z);
      const na = ca + mod(ta - ca + Math.PI, Math.PI * 2) * k - Math.PI * k;
      const nr = cr + (tr - cr) * k;
      this.camPos.set(nr * Math.sin(na), this.camPos.y + (V.wantPos.y - this.camPos.y) * k, nr * Math.cos(na));
      this.camLook.lerp(V.wantLook, k);
    }
    // never leave the corridor: keep the eye between the pillar and the outer wall
    const rr = Math.hypot(this.camPos.x, this.camPos.z);
    const clamped = THREE.MathUtils.clamp(rr, R_IN + 0.6, R_OUT - 0.6);
    if (rr > 0 && clamped !== rr) {
      this.camPos.x *= clamped / rr;
      this.camPos.z *= clamped / rr;
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // the pillar fades away while the camera stands inside it (intro)
    const camR = Math.hypot(this.camPos.x, this.camPos.z);
    const u = intro.phase === "done" ? 1 : THREE.MathUtils.smoothstep(camR, R_IN + 0.2, R_IN + 1.8);
    this.setOpacity(m.innerWall, u);
    for (const mat of m.inner) this.setOpacity(mat, u);
    for (const mat of m.innerLabel) this.setOpacity(mat, u);
    for (const mat of m.innerFrame) this.setOpacity(mat as unknown as THREE.MeshBasicMaterial, u);
    if (m.innerLogo) m.innerLogo.opacity = u;
    m.innerShadow.opacity = 0.55 * u;
    m.innerLamp.opacity = (m.innerLamp.userData.full ?? THEME.lamp) * u;
    m.innerBeam.opacity = (m.innerBeam.userData.full ?? THEME.beam) * u;

    // recycle the slots around the walker
    const P = this.places.length;
    // fill the slots around where the camera actually is: on a fast scroll it trails the walker,
    // and windowing on the walker's angle would leave bare wall right beside the camera
    const camA = a + (mod(Math.atan2(this.camPos.x, this.camPos.z) - a + Math.PI, Math.PI * 2) - Math.PI);
    const base = Math.floor(Math.min(a, camA) / STEP);
    let need = 0;
    let have = 0;
    const count = (t: THREE.Texture) => {
      need++;
      if (t.userData.ready ?? true) have++;
    };
    let sign = 0;
    for (let i = -BEHIND; i < SLOTS - BEHIND && sign < SIGN_POOL; i++) {
      const r = base + i;
      const pl = this.places[mod(r, P)];
      if (!pl.first) continue;
      const S = this.signs[sign++];
      // half a step before the collection's first piece, across the walkway, facing the walker
      const sa = (r - (SECTION_GAP + 1) / 2) * STEP;
      S.grp.visible = true;
      S.grp.position.set(CAM_R * Math.sin(sa), 0, CAM_R * Math.cos(sa));
      S.grp.rotation.y = sa - Math.PI / 2;
      S.swing.rotation.x = q ? 0 : 0.014 * Math.sin(elapsed * 0.8 + r);
      const tex = this.plaques[pl.col];
      count(tex);
      this.setMap(S.mat, tex);
    }
    for (; sign < SIGN_POOL; sign++) this.signs[sign].grp.visible = false;

    for (let i = -BEHIND; i < SLOTS - BEHIND; i++) {
      const s = i + BEHIND;
      const r = base + i;
      const pl = this.places[mod(r, P)];
      const ang = r * STEP;
      const colTitle = this.collections[pl.col].title;
      this.slotIndex[s] = r;

      // wall logos sit in the gap after this place: every 4th place, alternating outer wall / pillar
      const la = ang + STEP / 2;
      const ol = this.outerLogos[s];
      ol.visible = mod(r, 4) === 0;
      ol.rotation.y = la;
      const il = this.innerLogos[s];
      il.visible = mod(r, 4) === 2;
      il.rotation.y = la;

      const g = this.outerGroups[s];
      g.position.set((R_OUT - 0.03) * Math.sin(ang), 0, (R_OUT - 0.03) * Math.cos(ang));
      g.rotation.y = ang + Math.PI;
      g.visible = !!pl.outer;
      if (pl.outer) {
        const art = this.outerArt[s];
        this.lift(art, dt);
        art.scale.set(PRINT_H, PRINT_H, 1); // product shots are square
        this.fit(art, PRINT_H, PRINT_H, FRAME_BORDER);
        const lab = this.label(pl.outer, colTitle);
        this.placeLabel(this.outerLabel[s], m.outerLabel[s], lab, PRINT_H, PRINT_H);
        const tex = this.print(pl.outer.img);
        count(tex);
        this.setMap(m.outer[s], tex);
      }

      const gi = this.innerGroups[s];
      gi.visible = !!pl.inner;
      if (pl.inner) {
        const ia = ang + 0.04;
        gi.position.set(Math.sin(ia) * (R_IN + 0.03), 0, Math.cos(ia) * (R_IN + 0.03));
        gi.rotation.y = ia;
        const size = Math.min(1.305, INNER_MAX_W);
        this.innerArt[s].scale.set(size, size, 1);
        this.lift(this.innerArt[s], dt);
        this.fit(this.innerArt[s], size, size, FRAME_BORDER);
        const lab = this.label(pl.inner, colTitle);
        this.placeLabel(this.innerLabel[s], m.innerLabel[s], lab, size, size);
        const tex = this.print(pl.inner.img);
        count(tex);
        this.setMap(m.inner[s], tex);
      }
    }
    this.allVisibleLoaded = have === need;
    if (intro.phase === "wait") {
      const share = need ? have / need : 1;
      if (share !== this.lastProgress) {
        this.lastProgress = share;
        this.ev.onProgress(share);
      }
    }
    if (this.pending && Math.abs(w.target - w.at) < 0.01) {
      const s = this.slotIndex.indexOf(this.pending.r);
      if (s >= 0) {
        this.focus = this.pending.side === "outer" ? this.outerArt[s] : this.innerArt[s];
        this.focusAt = now;
      }
      this.pending = null;
    }

    // collection in view
    const col = this.places[mod(Math.round((a + 0.25) / STEP), P)].col;
    if (col !== this.col) {
      this.col = col;
      this.ev.onCollection(col);
    }

    // hover tip
    let tip: Tip = null;
    if (this.pointerIn) {
      const hit = this.pick();
      if (hit && !hit.userData.background) {
        tip = hit === this.focus ? "print" : "look";
      }
    }
    this.canvas.style.cursor = tip ? "pointer" : "";
    if (tip !== this.tip) {
      this.tip = tip;
      this.ev.onTip(tip);
    }
    if (this.focus !== this.lastFocused) {
      this.lastFocused = this.focus;
      if (!this.focus) this.ev.onFocus(null, "");
      else {
        const pl = this.placeOf(this.focus);
        const p = this.focus.userData.side === "inner" ? pl.inner : pl.outer;
        this.ev.onFocus(p, this.collections[pl.col].title);
      }
    }

    this.renderer.render(this.scene, this.camera);
  };
}
