const API_BASE = location.port === '3000' ? 'http://localhost:3001' : '';
const STORAGE_KEY = 'vabs-stock-counting-state';

const splash = document.querySelector('#splash');
const app = document.querySelector('#app');
const view = document.querySelector('#view');

let classes = [];
let selectedClass = null;
let selectedImage = null;
let selectedImageMeta = null;
let result = null;
let quantity = 0;
let isCounting = false;
let errorMessage = '';
let searchTerm = '';
let drafts = [];
let sentRounds = [];
let cameraStream = null;
let liveCameraStatus = 'idle';

restoreState();
lockMobileZoom();

setTimeout(() => {
  splash.hidden = true;
  app.hidden = false;
  route();
}, 900);

window.addEventListener('popstate', route);

function lockMobileZoom() {
  document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (event) => event.preventDefault(), { passive: false });

  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) event.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
}

async function api(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed ${response.status}`);
  return data;
}

async function loadClasses() {
  if (classes.length) return classes;
  const data = await api('/api/classes');
  classes = data.classes || [];
  return classes;
}

function restoreState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    selectedClass = saved.selectedClass || null;
    selectedImage = saved.selectedImage || null;
    selectedImageMeta = saved.selectedImageMeta || null;
    result = saved.result || null;
    quantity = Number(saved.quantity || 0);
    drafts = Array.isArray(saved.drafts) ? saved.drafts : [];
    sentRounds = Array.isArray(saved.sentRounds) ? saved.sentRounds : [];
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
    selectedClass,
    selectedImage,
    selectedImageMeta,
    result,
    quantity,
    drafts,
    sentRounds,
  }));
}

function resetCurrentFlow(keepClass = true) {
  if (!keepClass) selectedClass = null;
  selectedImage = null;
  selectedImageMeta = null;
  result = null;
  quantity = 0;
  isCounting = false;
  errorMessage = '';
  saveState();
}

function normalizeRoute(pathname) {
  if (pathname === '/' || pathname === '') return '/home';
  if (pathname === '/draft') return '/drafts';
  if (pathname === '/myinfo') return '/profile';
  if (pathname === '/stock/camera') return '/camera';
  if (pathname === '/stock/camera/sku') return '/camera/sku';
  if (pathname === '/stock/verify') return '/verify';
  if (pathname === '/stock/review') return '/review';
  return pathname;
}

function navigate(path) {
  if (normalizeRoute(path) !== '/camera') stopLiveCamera();
  history.pushState({}, '', path);
  route();
}

function activePath() {
  return normalizeRoute(location.pathname);
}

function header(title, options = {}) {
  const back = options.back ? `<button class="header-icon" data-action="${options.back}" aria-label="Back">${icon('chevron')}</button>` : '<span></span>';
  const close = options.close ? `<button class="header-icon" data-action="home" aria-label="Close">${icon('close')}</button>` : '<span></span>';
  return `
    <header class="app-header">
      ${back}
      <h1>${title}</h1>
      ${close}
    </header>
  `;
}

function attachHeaderActions() {
  view.querySelectorAll('[data-action="home"]').forEach((button) => button.addEventListener('click', () => navigate('/home')));
  view.querySelectorAll('[data-action="back-home"]').forEach((button) => button.addEventListener('click', () => navigate('/home')));
  view.querySelectorAll('[data-action="back-sku"]').forEach((button) => button.addEventListener('click', () => navigate('/camera/sku')));
  view.querySelectorAll('[data-action="back-camera"]').forEach((button) => button.addEventListener('click', () => navigate('/camera')));
  view.querySelectorAll('[data-action="back-verify"]').forEach((button) => button.addEventListener('click', () => navigate('/verify')));
}

function icon(name) {
  const icons = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/></svg>',
    drafts: '<svg viewBox="0 0 24 24"><path d="M16 4H6a2 2 0 0 0-2 2v10"/><path d="M8 8h10a2 2 0 0 1 2 2v7l-3 3h-7a2 2 0 0 1-2-2z"/><path d="M17 20v-3h3"/></svg>',
    sent: '<svg viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg>',
    profile: '<svg viewBox="0 0 24 24"><path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>',
  };
  return icons[name] || '';
}

function bottomNav(active) {
  const items = [
    { key: 'home', label: 'หน้าแรก', path: '/home', icon: 'home', badge: 0 },
    { key: 'drafts', label: 'บันทึกชั่วคราว', path: '/drafts', icon: 'drafts', badge: drafts.length },
    { key: 'sent', label: 'สต็อกที่ส่งแล้ว', path: '/sent', icon: 'sent', badge: 0 },
    { key: 'profile', label: 'ข้อมูลของฉัน', path: '/profile', icon: 'profile', badge: 0 },
  ];

  return `
    <nav class="bottom-nav">
      ${items.map((item) => `
        <button class="${active === item.key ? 'active' : ''}" data-nav="${item.path}">
          <span class="nav-icon">${icon(item.icon)}${item.badge ? `<b>${item.badge}</b>` : ''}</span>
          <span>${item.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

function attachBottomNav() {
  view.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.nav));
  });
}

function imageFor(item) {
  return `<img src="${item.imageUrl}" alt="${item.name}" loading="lazy" />`;
}

function classSku(item) {
  return `VABS-${String(item.id).padStart(3, '0')}`;
}

function filteredClasses() {
  return classes.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return item.name.toLowerCase().includes(term) || classSku(item).toLowerCase().includes(term) || String(item.id).includes(term);
  });
}

function attachProductStartActions(root = view) {
  root.querySelectorAll('[data-start-class]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedClass = classes.find((item) => item.id === Number(button.dataset.startClass));
      resetCurrentFlow(true);
      navigate('/camera/sku');
    });
  });
}

function updateHomeResults() {
  const visible = filteredClasses();
  const count = view.querySelector('#homeCount');
  const list = view.querySelector('#productList');

  if (count) count.textContent = `รายการทั้งหมด ${visible.length} รายการ`;
  if (list) {
    list.innerHTML = visible.map(productCard).join('');
    attachProductStartActions(list);
  }
}

function renderHome() {
  const visible = filteredClasses();

  view.innerHTML = `
    <div class="page page-with-nav">
      ${header('รายการสินค้าที่ต้องนับสต็อก')}
      <div class="counting-band">VAbs Counting</div>
      <main class="content">
        <label class="search-field">
          ${icon('search')}
          <input id="homeSearch" value="${searchTerm}" placeholder="ค้นหาสินค้า / class" />
        </label>
        <div class="list-meta">
          <span id="homeCount">รายการทั้งหมด ${visible.length} รายการ</span>
          <strong>VAbs Counting</strong>
        </div>
        <section id="productList" class="product-list">
          ${visible.map(productCard).join('')}
        </section>
      </main>
      <div class="deadline-card">
        <span>⏱</span>
        <strong>หมดเวลาการนับ: 02:14:35</strong>
      </div>
      ${bottomNav('home')}
    </div>
  `;

  attachHeaderActions();
  attachBottomNav();
  view.querySelector('#homeSearch').addEventListener('input', (event) => {
    searchTerm = event.target.value;
    updateHomeResults();
  });
  attachProductStartActions();
}

function productCard(item) {
  return `
    <article class="product-card" data-start-class="${item.id}">
      <button class="product-hit" data-start-class="${item.id}" aria-label="Start ${item.name}"></button>
      <div class="product-thumb">${imageFor(item)}</div>
      <div class="product-copy">
        <p>SKU: ${classSku(item)}</p>
        <h2>${item.name}</h2>
      </div>
      <button class="stockout-button" data-start-class="${item.id}">แจ้งสินค้าหมด</button>
    </article>
  `;
}

function renderSkuConfirm() {
  if (!selectedClass) {
    navigate('/home');
    return;
  }

  view.innerHTML = `
    <div class="page">
      ${header('ตรวจสอบสินค้า', { back: 'back-home', close: true })}
      <main class="content product-confirm">
        <div class="hero-product">${imageFor(selectedClass)}</div>
        <h2>รูปตัวอย่างการถ่ายภาพนับสินค้า</h2>
        <div class="sku-panel">
          <span>โมเดลที่เลือก</span>
          <strong>${classSku(selectedClass)}</strong>
          <b>${selectedClass.name}</b>
        </div>
      </main>
      <footer class="fixed-actions">
        <button id="confirmSku" class="primary-action">ยืนยัน</button>
        <button id="rescanSku" class="secondary-action">เลือกโมเดลอีกครั้ง</button>
      </footer>
    </div>
  `;
  attachHeaderActions();
  view.querySelector('#confirmSku').addEventListener('click', () => navigate('/camera'));
  view.querySelector('#rescanSku').addEventListener('click', () => navigate('/home'));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load selected image'));
    image.src = src;
  });
}

function imageToJpegDataUrl(image) {
  const sourceWidth = image.naturalWidth || image.width || 1;
  const sourceHeight = image.naturalHeight || image.height || 1;
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    width,
    height,
  };
}

function friendlyCaptureError(err) {
  const message = err?.message || '';
  if (/load selected image|read file/i.test(message)) return 'อ่านรูปจากกล้องไม่ได้ กรุณาถ่ายภาพใหม่หรือเลือกรูปจากไฟล์';
  if (/fetch|failed|network|request/i.test(message)) return 'ประมวลผลรูปไม่สำเร็จ กรุณาลองอีกครั้ง';
  return message || 'ประมวลผลรูปไม่สำเร็จ กรุณาลองอีกครั้ง';
}

async function detectSelectedImage() {
  return api('/api/detect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: selectedImage, targetClassId: selectedClass.id }),
  });
}

async function setImageFromFile(file, captureInput = null) {
  if (!file || isCounting) return;
  isCounting = true;
  result = null;
  quantity = 0;
  errorMessage = '';
  renderCamera();

  try {
    const rawImage = await readFileAsDataUrl(file);
    const image = await loadImage(rawImage);
    const prepared = imageToJpegDataUrl(image);
    selectedImage = prepared.dataUrl;
    selectedImageMeta = {
      naturalWidth: prepared.width,
      naturalHeight: prepared.height,
    };
    saveState();
    renderCamera();
    result = await detectSelectedImage();
    quantity = Number(result.count || 0);
    saveState();
    isCounting = false;
    if (captureInput) captureInput.value = '';
    navigate('/verify');
  } catch (err) {
    isCounting = false;
    if (captureInput) captureInput.value = '';
    errorMessage = friendlyCaptureError(err);
    renderCamera();
  }
}

async function startLiveCamera() {
  const video = view.querySelector('#cameraVideo');
  if (!video || cameraStream || isCounting) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    liveCameraStatus = 'unsupported';
    renderCamera();
    return;
  }

  liveCameraStatus = 'starting';
  updateCameraStatus();
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    const currentVideo = view.querySelector('#cameraVideo');
    if (!currentVideo) {
      stopLiveCamera();
      return;
    }
    currentVideo.srcObject = cameraStream;
    await currentVideo.play();
    liveCameraStatus = 'ready';
    updateCameraStatus();
  } catch (err) {
    liveCameraStatus = 'error';
    errorMessage = 'เปิดกล้องไม่ได้ กรุณากดถ่ายภาพหรือเลือกรูปจากไฟล์อีกครั้ง';
    updateCameraStatus();
  }
}

function stopLiveCamera() {
  if (!cameraStream) return;
  for (const track of cameraStream.getTracks()) track.stop();
  cameraStream = null;
  liveCameraStatus = 'idle';
}

function updateCameraStatus() {
  const status = view.querySelector('#cameraStatus');
  if (!status) return;
  const labels = {
    idle: 'เปิดกล้องของเครื่องหรือเลือกรูปจากไฟล์',
    starting: 'กำลังเปิดกล้อง...',
    ready: 'กล้องพร้อมถ่ายภาพ',
    unsupported: 'อุปกรณ์นี้ไม่รองรับ live camera',
    error: errorMessage || 'เปิดกล้องไม่สำเร็จ',
  };
  status.textContent = labels[liveCameraStatus] || labels.idle;
}

function prefersNativeCameraCapture() {
  const userAgent = navigator.userAgent || '';
  const isTouchMac = /Macintosh/i.test(userAgent) && Number(navigator.maxTouchPoints || 0) > 1;
  return /iPad|iPhone|iPod|Android/i.test(userAgent)
    || isTouchMac
    || Boolean(window.matchMedia?.('(pointer: coarse)').matches);
}

function startCaptureFlow(cameraInput) {
  if (isCounting) return;
  if (cameraStream) {
    captureLiveFrame();
    return;
  }
  if (prefersNativeCameraCapture() || !navigator.mediaDevices?.getUserMedia) {
    cameraInput.click();
    return;
  }
  startLiveCamera();
}

async function captureLiveFrame() {
  if (!cameraStream || isCounting) return;
  const video = view.querySelector('#cameraVideo');
  const canvas = view.querySelector('#captureCanvas');
  if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
    errorMessage = 'กล้องยังไม่พร้อม กรุณาลองอีกครั้ง';
    renderCamera();
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  selectedImage = canvas.toDataURL('image/jpeg', 0.92);
  selectedImageMeta = {
    naturalWidth: canvas.width,
    naturalHeight: canvas.height,
  };
  result = null;
  quantity = 0;
  errorMessage = '';
  saveState();
  stopLiveCamera();
  await runDetect();
}

async function runDetect() {
  if (!selectedClass || !selectedImage || isCounting) return;
  isCounting = true;
  errorMessage = '';
  renderCamera();
  try {
    result = await detectSelectedImage();
    quantity = Number(result.count || 0);
    saveState();
    navigate('/verify');
  } catch (err) {
    errorMessage = err.message;
    renderCamera();
  } finally {
    isCounting = false;
  }
}

function detectionDots() {
  if (!result?.detections?.length || !selectedImageMeta) return '';
  return result.detections.map((det, index) => {
    const x = Math.max(0, Math.min(100, (det.x / selectedImageMeta.naturalWidth) * 100));
    const y = Math.max(0, Math.min(100, (det.y / selectedImageMeta.naturalHeight) * 100));
    return `<span class="count-dot" style="left:${x}%;top:${y}%">${index + 1}</span>`;
  }).join('');
}

function verifyPhotoStyle() {
  const width = Number(selectedImageMeta?.naturalWidth || 0);
  const height = Number(selectedImageMeta?.naturalHeight || 0);
  if (!width || !height) return '';
  return `style="aspect-ratio:${width} / ${height}"`;
}

function renderCamera() {
  if (!selectedClass) {
    navigate('/home');
    return;
  }

  view.innerHTML = `
    <div class="page">
      ${header('ถ่ายภาพสินค้า', { back: 'back-sku', close: true })}
      <main class="content camera-content">
        <input id="cameraInput" class="visually-hidden" type="file" accept="image/*" capture="environment" />
        <input id="fileInput" class="visually-hidden" type="file" accept="image/*" />
        <canvas id="captureCanvas" class="visually-hidden"></canvas>
        <button id="cameraStage" class="camera-stage" ${isCounting ? 'disabled' : ''}>
          ${selectedImage ? `<img src="${selectedImage}" alt="captured" />${detectionDots()}` : cameraPlaceholder()}
          ${isCounting ? '<div class="processing-overlay"><strong>กำลังนับสต็อก</strong></div>' : ''}
        </button>
        <div class="small-product-card">
          <div class="product-thumb small">${imageFor(selectedClass)}</div>
          <div>
            <p>SKU: ${classSku(selectedClass)}</p>
            <h2>${selectedClass.name}</h2>
          </div>
        </div>
        ${errorMessage ? `<p class="error-banner">${errorMessage}</p>` : ''}
      </main>
      <footer class="fixed-actions">
        <button id="takePhoto" class="primary-action">ถ่ายภาพ</button>
        <button id="chooseFile" class="secondary-action">เลือกรูปจากไฟล์</button>
      </footer>
    </div>
  `;
  attachHeaderActions();
  const cameraInput = view.querySelector('#cameraInput');
  const fileInput = view.querySelector('#fileInput');
  view.querySelector('#cameraStage').addEventListener('click', () => startCaptureFlow(cameraInput));
  view.querySelector('#takePhoto').addEventListener('click', () => startCaptureFlow(cameraInput));
  view.querySelector('#chooseFile').addEventListener('click', () => fileInput.click());
  cameraInput.addEventListener('change', (event) => void setImageFromFile(event.currentTarget.files?.[0], event.currentTarget));
  fileInput.addEventListener('change', (event) => void setImageFromFile(event.currentTarget.files?.[0], event.currentTarget));
}

function cameraPlaceholder() {
  return `
    <div class="camera-placeholder">
      <span>${icon('camera')}</span>
      <strong>แตะเพื่อถ่ายภาพ</strong>
      <small id="cameraStatus">เปิดกล้องของเครื่องหรือเลือกรูปจากไฟล์</small>
      <video id="cameraVideo" playsinline autoplay muted></video>
    </div>
  `;
}

function renderVerify() {
  if (!selectedClass || !selectedImage || !result) {
    navigate(selectedClass ? '/camera' : '/home');
    return;
  }

  view.innerHTML = `
    <div class="page">
      ${header('ตรวจสอบผลิตภัณฑ์', { back: 'back-camera', close: true })}
      <main class="content verify-content">
        <div class="verify-photo" ${verifyPhotoStyle()}>
          <img src="${selectedImage}" alt="Counting" />
          ${detectionDots()}
        </div>
        <p class="found-text">พบสินค้า ${Number(result.count || 0)} ชิ้น</p>
        <div class="small-product-card">
          <div class="product-thumb small">${imageFor(selectedClass)}</div>
          <div>
            <p>SKU: ${classSku(selectedClass)}</p>
            <h2>${selectedClass.name}</h2>
          </div>
        </div>
        <div class="quantity-card">
          <p>จำนวนที่ตรวจสอบ</p>
          <div>
            <button id="minusQty">−</button>
            <strong>${quantity}</strong>
            <button id="plusQty">+</button>
          </div>
          <span>หน่วย</span>
        </div>
        <div class="warning-pill"><b>!</b> กรุณาตรวจสอบจำนวนก่อนยืนยัน</div>
      </main>
      <footer class="fixed-actions">
        <button id="confirmVerify" class="primary-action">ยืนยัน</button>
        <button id="retakePhoto" class="secondary-action">ถ่ายภาพสินค้าใหม่</button>
      </footer>
    </div>
  `;
  attachHeaderActions();
  view.querySelector('#minusQty').addEventListener('click', () => {
    quantity = Math.max(0, quantity - 1);
    saveState();
    renderVerify();
  });
  view.querySelector('#plusQty').addEventListener('click', () => {
    quantity += 1;
    saveState();
    renderVerify();
  });
  view.querySelector('#confirmVerify').addEventListener('click', () => navigate('/review'));
  view.querySelector('#retakePhoto').addEventListener('click', () => {
    resetCurrentFlow(true);
    navigate('/camera');
  });
}

function currentDraftPayload() {
  return {
    id: `${Date.now()}-${selectedClass.id}`,
    sku: classSku(selectedClass),
    productName: selectedClass.name,
    quantity,
    imageUrl: selectedImage,
    rawFile: result?.files?.raw || null,
    annotatedFile: result?.files?.annotatedImage || result?.files?.annotatedJson || null,
    createdAt: new Date().toISOString(),
  };
}

function saveDraft() {
  if (!selectedClass || !result) return;
  drafts = [currentDraftPayload(), ...drafts];
  resetCurrentFlow(false);
  searchTerm = '';
  saveState();
  navigate('/home');
}

function renderReview() {
  if (!selectedClass || !result) {
    navigate('/home');
    return;
  }
  const rawName = (result.files?.raw || '').split('/').pop() || '-';
  const annotatedName = (result.files?.annotatedImage || result.files?.annotatedJson || '').split('/').pop() || '-';

  view.innerHTML = `
    <div class="page">
      ${header('ตรวจสอบรายละเอียด', { back: 'back-verify', close: true })}
      <main class="content review-content">
        <div class="review-product">
          <div class="product-thumb">${imageFor(selectedClass)}</div>
          <div>
            <p>SKU: ${classSku(selectedClass)}</p>
            <h2>${selectedClass.name}</h2>
            <strong>${quantity} หน่วย</strong>
          </div>
        </div>
        <dl class="detail-panel">
          <dt>แอป:</dt><dd>VAbs Counting</dd>
          <dt>คุณภาพรูปภาพ:</dt><dd>คุณภาพสมบูรณ์แบบ</dd>
          <dt>ระบบตรวจจับ:</dt><dd>VAbs Vision</dd>
          <dt>ไฟล์ต้นฉบับ:</dt><dd>${rawName}</dd>
          <dt>ผลลัพธ์:</dt><dd>${annotatedName}</dd>
        </dl>
      </main>
      <footer class="fixed-actions">
        <button id="saveDraft" class="secondary-action">บันทึกชั่วคราว</button>
        <button id="sendAdmin" class="primary-action">ส่งยอดนับสต็อกให้แอดมิน</button>
      </footer>
    </div>
  `;
  attachHeaderActions();
  view.querySelector('#saveDraft').addEventListener('click', saveDraft);
  view.querySelector('#sendAdmin').addEventListener('click', () => {
    drafts = [currentDraftPayload(), ...drafts];
    sendDrafts();
  });
}

function sendDrafts() {
  if (!drafts.length) return;
  const totalUnits = drafts.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  sentRounds = [{
    id: `round-${Date.now()}`,
    sentAt: new Date().toISOString(),
    totalItems: drafts.length,
    totalUnits,
    items: drafts,
  }, ...sentRounds];
  drafts = [];
  resetCurrentFlow(false);
  searchTerm = '';
  saveState();
  navigate('/home');
}

function renderDrafts() {
  const totalUnits = drafts.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  view.innerHTML = `
    <div class="page page-with-nav">
      ${header('บันทึกชั่วคราว')}
      <div class="filter-pills">
        <button class="active">VAbs Counting</button>
      </div>
      <main class="content">
        ${drafts.length ? statsCard(drafts.length, totalUnits) : ''}
        <section class="draft-list">
          ${drafts.length ? drafts.map(draftCard).join('') : emptyState('ยังไม่มีบันทึกชั่วคราว')}
        </section>
      </main>
      <footer class="send-footer">
        <button id="sendDrafts" class="primary-action" ${drafts.length ? '' : 'disabled'}>ส่งยอดนับสต็อกให้แอดมิน</button>
      </footer>
      ${bottomNav('drafts')}
    </div>
  `;
  attachHeaderActions();
  attachBottomNav();
  view.querySelectorAll('[data-delete-draft]').forEach((button) => {
    button.addEventListener('click', () => {
      drafts = drafts.filter((item) => item.id !== button.dataset.deleteDraft);
      saveState();
      renderDrafts();
    });
  });
  view.querySelector('#sendDrafts').addEventListener('click', sendDrafts);
}

function statsCard(totalItems, totalUnits) {
  return `
    <div class="stats-card">
      <div><strong>${totalItems}</strong><span>รายการทั้งหมด</span></div>
      <div><strong>${totalUnits}</strong><span>หน่วยรวม</span></div>
    </div>
  `;
}

function draftCard(item) {
  return `
    <article class="draft-card">
      <div class="draft-location">VAbs Counting</div>
      <div class="draft-row">
        <div class="product-thumb">${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.productName}" />` : ''}</div>
        <div class="draft-copy">
          <p>SKU: ${item.sku}</p>
          <h2>${item.productName}</h2>
          <strong>${item.quantity} หน่วย</strong>
        </div>
        <button class="delete-button" data-delete-draft="${item.id}">${icon('trash')}</button>
      </div>
    </article>
  `;
}

function renderSent() {
  const latest = sentRounds[0];
  view.innerHTML = `
    <div class="page page-with-nav">
      ${header('สต็อกที่ส่งแล้ว')}
      <main class="content">
        ${latest ? sentFolder(latest) : emptyState('ยังไม่มีรายการที่ส่งแล้ว')}
      </main>
      ${bottomNav('sent')}
    </div>
  `;
  attachHeaderActions();
  attachBottomNav();
}

function sentFolder(round) {
  return `
    <article class="sent-folder">
      <p>${new Date(round.sentAt).toLocaleString('th-TH')}</p>
      <h2>รอบการนับสต็อก VAbs</h2>
      ${statsCard(round.totalItems, round.totalUnits)}
      <div class="sent-items">
        ${round.items.slice(0, 4).map((item) => `<span>${item.sku} · ${item.quantity} หน่วย</span>`).join('')}
      </div>
    </article>
  `;
}

function renderProfile() {
  view.innerHTML = `
    <div class="page page-with-nav">
      ${header('ข้อมูลของฉัน')}
      <main class="content profile-content">
        <div class="profile-card">
          <div class="vabs-logo">V</div>
          <h2>VAbs Solution</h2>
          <p>Visual counting intelligence</p>
        </div>
        <dl class="detail-panel">
          <dt>ผู้ใช้งาน:</dt><dd>Local Demo</dd>
          <dt>สาขา:</dt><dd>Local PC</dd>
          <dt>ระบบตรวจจับ:</dt><dd>VAbs Vision</dd>
          <dt>Raw:</dt><dd>baksters_counting/raw</dd>
          <dt>Annotated:</dt><dd>baksters_counting/annotated</dd>
        </dl>
      </main>
      ${bottomNav('profile')}
    </div>
  `;
  attachHeaderActions();
  attachBottomNav();
}

function emptyState(text) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon('drafts')}</div>
      <p>${text}</p>
    </div>
  `;
}

async function route() {
  try {
    await loadClasses();
    const path = normalizeRoute(location.pathname);
    if (path !== '/camera') stopLiveCamera();
    if (path !== location.pathname) {
      history.replaceState({}, '', path);
    }
    if (path === '/camera/sku') renderSkuConfirm();
    else if (path === '/camera') renderCamera();
    else if (path === '/verify') renderVerify();
    else if (path === '/review') renderReview();
    else if (path === '/drafts') renderDrafts();
    else if (path === '/sent') renderSent();
    else if (path === '/profile') renderProfile();
    else renderHome();
  } catch (err) {
    splash.hidden = true;
    app.hidden = false;
    view.innerHTML = `
      <div class="page">
        ${header('VAbs Solution')}
        <main class="content">${emptyState(err.message)}</main>
      </div>
    `;
    attachHeaderActions();
  }
}
