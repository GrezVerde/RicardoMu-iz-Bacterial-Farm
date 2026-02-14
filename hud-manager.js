// ================================
// HUD MANAGER (LIMPIO) - Escala única con regla + valor
// API pública: actualizarEscalaHUD(unidad, valor)
// EXTRA: setHUDMicroscopio('4x'|'10x'|'40x'|'100x') y bindHUDToZoomButtons()
// ================================

let valorActual = 0;

// --- Tabla de escalas del microscopio ---
const ESCALAS_MICROSCOPIO = {
  '4x':   { unidad: 'mm', valor: 4.5 },
  '10x':  { unidad: 'mm', valor: 1.8 },
  '40x':  { unidad: 'μm', valor: 450 },
  '100x': { unidad: 'μm', valor: 180 }
};

// --- Inyectar HUD único si no existe ---
function asegurarHUD() {
  if (document.getElementById('hud-escala')) return;

  const hudHTML = `
    <div id="hud-escala" class="hud-escala">
      <div class="escala-label">Resolución de Óptica</div>

      <div class="escala-regla" aria-hidden="true">
        <div class="ticks major"></div>
        <div class="ticks minor"></div>
        <div class="ticks micro"></div>
      </div>

      <div class="escala-valor">
        <span id="escala-num">0</span>
        <span id="escala-uni" class="escala-unidad">m</span>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', hudHTML);
}

// --- Utilidad: re-disparar animación CSS (densidad/entrada) ---
function dispararAnimacionHUD(contenedor) {
  contenedor.classList.remove('anim');
  void contenedor.offsetWidth; // reflow para reiniciar animación
  contenedor.classList.add('anim');
}

// --- Animación numérica suave ---
function animarNumero(displayValor, start, end, duration = 800) {
  let startTime = null;

  function frame(currentTime) {
    if (!startTime) startTime = currentTime;
    let progress = (currentTime - startTime) / duration;
    if (progress > 1) progress = 1;

    const current = start + (end - start) * progress;

    // Formato: 1 decimal si <10, entero si >=10
    displayValor.innerText = current.toFixed(current < 10 ? 1 : 0);

    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ================================
// ✅ FUNCIÓN PÚBLICA PRINCIPAL
// ================================
function actualizarEscalaHUD(nuevaUnidad, nuevoValor) {
  asegurarHUD();

  const contenedor = document.getElementById('hud-escala');
  const displayValor = document.getElementById('escala-num');
  const displayUnidad = document.getElementById('escala-uni');

  if (!contenedor || !displayValor || !displayUnidad) return;

  displayUnidad.innerText = nuevaUnidad;
  dispararAnimacionHUD(contenedor);
  animarNumero(displayValor, valorActual, nuevoValor, 800);

  valorActual = nuevoValor;
}

window.actualizarEscalaHUD = actualizarEscalaHUD;

// ================================
// ✅ EXTRA: API para el microscopio
// ================================
function setHUDMicroscopio(zoomLabel) {
  const key = String(zoomLabel || '').toLowerCase();
  const data = ESCALAS_MICROSCOPIO[key];
  if (!data) return;
  actualizarEscalaHUD(data.unidad, data.valor);
}

window.setHUDMicroscopio = setHUDMicroscopio;

// Engancha automáticamente el HUD a los botones del zoom si existen
function bindHUDToZoomButtons() {
  const controles = document.getElementById('controles-zoom');
  if (!controles) return;

  // 1) Estado inicial: toma el botón .activo o el primero
  const btnInicial = controles.querySelector('.btn-zoom.activo') || controles.querySelector('.btn-zoom');
  if (btnInicial) {
    const label = (btnInicial.textContent || '').trim();
    if (ESCALAS_MICROSCOPIO[label.toLowerCase()]) setHUDMicroscopio(label);
  }

  // 2) Escuchar clicks en el contenedor (funciona aunque tus botones usen onclick aplicarZoom)
  controles.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-zoom');
    if (!btn) return;

    const label = (btn.textContent || '').trim();
    setHUDMicroscopio(label);
  });
}

window.bindHUDToZoomButtons = bindHUDToZoomButtons;

// --- Asegurar HUD al cargar ---
window.addEventListener('DOMContentLoaded', () => {
  asegurarHUD();
  bindHUDToZoomButtons();
});
