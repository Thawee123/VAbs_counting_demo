import { COCO_CLASSES } from './cocoClasses.mjs';

const ICONS = {
  person: '🚶',
  bicycle: '🚲',
  car: '🚗',
  motorcycle: '🏍️',
  airplane: '✈️',
  bus: '🚌',
  train: '🚆',
  truck: '🚚',
  boat: '🚤',
  'traffic light': '🚦',
  'fire hydrant': '🧯',
  'stop sign': '🛑',
  'parking meter': '🅿️',
  bench: '🪑',
  bird: '🐦',
  cat: '🐱',
  dog: '🐶',
  horse: '🐴',
  sheep: '🐑',
  cow: '🐄',
  elephant: '🐘',
  bear: '🐻',
  zebra: '🦓',
  giraffe: '🦒',
  backpack: '🎒',
  umbrella: '☂️',
  handbag: '👜',
  tie: '👔',
  suitcase: '🧳',
  frisbee: '🥏',
  skis: '🎿',
  snowboard: '🏂',
  'sports ball': '⚽',
  kite: '🪁',
  'baseball bat': '🏏',
  'baseball glove': '🧤',
  skateboard: '🛹',
  surfboard: '🏄',
  'tennis racket': '🎾',
  bottle: '🧴',
  'wine glass': '🍷',
  cup: '☕',
  fork: '🍴',
  knife: '🔪',
  spoon: '🥄',
  bowl: '🥣',
  banana: '🍌',
  apple: '🍎',
  sandwich: '🥪',
  orange: '🍊',
  broccoli: '🥦',
  carrot: '🥕',
  'hot dog': '🌭',
  pizza: '🍕',
  donut: '🍩',
  cake: '🎂',
  chair: '🪑',
  couch: '🛋️',
  'potted plant': '🪴',
  bed: '🛏️',
  'dining table': '🍽️',
  toilet: '🚽',
  tv: '📺',
  laptop: '💻',
  mouse: '🖱️',
  remote: '🎛️',
  keyboard: '⌨️',
  'cell phone': '📱',
  microwave: '📻',
  oven: '♨️',
  toaster: '🍞',
  sink: '🚰',
  refrigerator: '🧊',
  book: '📚',
  clock: '🕒',
  vase: '🏺',
  scissors: '✂️',
  'teddy bear': '🧸',
  'hair drier': '💨',
  toothbrush: '🪥',
};

const PALETTES = [
  ['#6ef4f3', '#221546', '#fff5cc', '#ff6b4a'],
  ['#ffd166', '#221546', '#e8fbff', '#6ef4f3'],
  ['#ff8fab', '#221546', '#f4edff', '#6ef4f3'],
  ['#9bf6a5', '#221546', '#fff7f0', '#ff6b4a'],
  ['#a0c4ff', '#221546', '#f7fff7', '#6ef4f3'],
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function encodedSvg(item) {
  const [accent, ink, paper, coral] = PALETTES[item.id % PALETTES.length];
  const label = escapeXml(item.name);
  const icon = escapeXml(ICONS[item.name] || '✨');
  const tilt = (item.id % 2 === 0 ? -1 : 1) * (3 + (item.id % 5));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
    <rect width="640" height="480" rx="56" fill="#ffffff"/>
    <rect x="28" y="28" width="584" height="424" rx="48" fill="${paper}" stroke="${accent}" stroke-width="10"/>
    <circle cx="110" cy="118" r="54" fill="${accent}" opacity=".72"/>
    <circle cx="524" cy="338" r="88" fill="${coral}" opacity=".16"/>
    <path d="M96 358 C174 314 246 408 332 350 C402 304 468 326 542 282" fill="none" stroke="${accent}" stroke-width="24" stroke-linecap="round" opacity=".62"/>
    <g transform="translate(320 202) rotate(${tilt})">
      <ellipse cx="0" cy="118" rx="130" ry="26" fill="${ink}" opacity=".13"/>
      <rect x="-138" y="-138" width="276" height="276" rx="62" fill="#ffffff" stroke="${ink}" stroke-width="10"/>
      <text x="0" y="44" text-anchor="middle" dominant-baseline="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif" font-size="132">${icon}</text>
    </g>
    <text x="320" y="398" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="${ink}">${label}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const CLASS_IMAGES = COCO_CLASSES.map((item) => ({
  ...item,
  imageUrl: encodedSvg(item),
  sourceUrl: 'local-cartoon-svg-openmoji-style-reference',
  placeholder: false,
  style: 'cartoon',
}));
