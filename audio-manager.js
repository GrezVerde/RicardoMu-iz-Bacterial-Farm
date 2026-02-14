// --- CONFIGURACIÓN DE PISTAS ---
const TRACKS = [
  'Assets/musica_lab.mp3',      // Índice 0
  'Assets/musica_petri.mp3',    // Índice 1
  'Assets/musica_jardin.mp3'    // Índice 2
];

let currentAudio = new Audio();
currentAudio.loop = true;

const MAX_VOLUME = 0.3; // Tu volumen objetivo
const STATE_KEY_V2 = 'bacterial_music_state_v2';

// ------------------------------
// ✅ ESTADO ROBUSTO (V2 + legacy)
// ------------------------------
function getMusicState() {
  // Intenta v2
  try {
    const st = JSON.parse(localStorage.getItem(STATE_KEY_V2)) || {};
    const playing = (typeof st.playing === 'boolean') ? st.playing : null;
    const muted   = (typeof st.muted === 'boolean') ? st.muted : null;
    const volume  = (typeof st.volume === 'number') ? st.volume : null;

    // Si trae algo usable, lo devolvemos normalizado
    if (playing !== null || muted !== null || volume !== null) {
      return {
        playing: playing ?? (localStorage.getItem('music_playing') === 'true'),
        muted: muted ?? false,
        volume: volume ?? MAX_VOLUME
      };
    }
  } catch (e) {}

  // Fallback legacy
  return {
    playing: localStorage.getItem('music_playing') === 'true',
    muted: false,
    volume: MAX_VOLUME
  };
}

function setMusicState(nextPartial) {
  const prev = getMusicState();
  const next = {
    playing: (typeof nextPartial.playing === 'boolean') ? nextPartial.playing : prev.playing,
    muted:   (typeof nextPartial.muted === 'boolean') ? nextPartial.muted : prev.muted,
    volume:  (typeof nextPartial.volume === 'number') ? nextPartial.volume : prev.volume
  };

  // Guarda v2
  localStorage.setItem(STATE_KEY_V2, JSON.stringify(next));

  // Mantén compatibilidad con tu estado viejo
  localStorage.setItem('music_playing', next.playing ? 'true' : 'false');

  return next;
}

// ------------------------------
// ✅ MÚSICA POR PÁGINA
// ------------------------------
function iniciarMusicaPagina(index) {
  const src = TRACKS[index];
  const { playing, muted, volume } = getMusicState();

  // Normaliza volume si alguien guardó algo raro
  const targetVol = (typeof volume === 'number' && isFinite(volume)) ? volume : MAX_VOLUME;

  // Evitar recargar si ya es la misma pista (comparación robusta)
  const fullTargetSrc = new URL(src, window.location.origin).href;
  if (currentAudio.src === fullTargetSrc) {
    // Asegura que el estado mute/vol se aplique incluso si ya estaba el src
    currentAudio.muted = !!muted;
    if (!muted) currentAudio.volume = Math.min(targetVol, MAX_VOLUME);
    return;
  }

  currentAudio.src = src;

  // Aplicar mute desde el inicio
  currentAudio.muted = !!muted;

  // Empezamos en silencio para el Fade-In (si no está muteado)
  currentAudio.volume = muted ? 0 : 0;

  currentAudio.onloadedmetadata = function () {
    const savedData = JSON.parse(localStorage.getItem('bacterial_music_data')) || {};
    const trackData = savedData[src];

    if (trackData) {
      // --- CORRECTOR DE DELAY ---
      const ahora = Date.now();
      const diferencia = (ahora - trackData.timestamp) / 1000;

      let tiempoCorregido = trackData.time + diferencia;

      if (currentAudio.duration && tiempoCorregido > currentAudio.duration) {
        tiempoCorregido = tiempoCorregido % currentAudio.duration;
      }

      try { currentAudio.currentTime = tiempoCorregido; } catch (e) {}
    }

    // Si debe sonar, reproduce con fade (si no está mute)
    if (playing && !muted) {
      reproducirConFade(targetVol);
    }
  };
}

// Suaviza la entrada de la música para ocultar el corte
function reproducirConFade(targetVol = MAX_VOLUME) {
  // Respeta mute
  if (currentAudio.muted) return;

  const finalVol = Math.min(targetVol, MAX_VOLUME);

  currentAudio.play().then(() => {
    currentAudio.volume = Math.max(0, Math.min(currentAudio.volume, finalVol));

    let fadeInterval = setInterval(() => {
      // Si durante el fade se mutea o pausa, cancelamos
      if (currentAudio.muted || currentAudio.paused) {
        clearInterval(fadeInterval);
        return;
      }

      if (currentAudio.volume < finalVol) {
        currentAudio.volume = Math.min(currentAudio.volume + 0.02, finalVol);
      } else {
        clearInterval(fadeInterval);
      }
    }, 50);
  }).catch(() => {
    // Interacción requerida para audio (normal en navegadores)
    console.log("Interacción requerida para audio");
  });
}

// Guardar tiempo + timestamp cada 200ms para máxima precisión
setInterval(() => {
  if (!currentAudio.paused && currentAudio.src) {
    const savedData = JSON.parse(localStorage.getItem('bacterial_music_data')) || {};
    const relativa = currentAudio.getAttribute('src');

    savedData[relativa] = {
      time: currentAudio.currentTime,
      timestamp: Date.now()
    };

    localStorage.setItem('bacterial_music_data', JSON.stringify(savedData));
  }
}, 200);

// ------------------------------
// ✅ TOGGLE GLOBAL (con v2 + legacy)
// ------------------------------
function toggleMusicaGlobal() {
  const st = getMusicState();

  // Interpretación:
  // - "apagada" = paused OR muted OR playing false
  // - cuando el usuario togglea:
  //     si está apagada -> la prendemos (playing=true, muted=false)
  //     si está prendida -> la apagamos (playing=false) + pausamos
  const estaSonando = (!currentAudio.paused) && (!st.muted) && (st.playing === true);

  if (!estaSonando) {
    // Encender
    const next = setMusicState({ playing: true, muted: false, volume: st.volume ?? MAX_VOLUME });
    currentAudio.muted = false;
    reproducirConFade(next.volume);
  } else {
    // Apagar
    currentAudio.pause();
    setMusicState({ playing: false });
  }
}

// ------------------------------
// ✅ Sincronización entre pestañas
// ------------------------------
window.addEventListener('storage', (e) => {
  if (e.key !== STATE_KEY_V2 && e.key !== 'music_playing') return;

  const st = getMusicState();

  currentAudio.muted = !!st.muted;

  // Si en otra pestaña lo apagaron
  if (!st.playing) {
    if (!currentAudio.paused) currentAudio.pause();
    return;
  }

  // Si lo prendieron y no está mute
  if (st.playing && !st.muted) {
    // Si ya hay src cargado, reproduce; si no, lo manejará iniciarMusicaPagina()
    if (currentAudio.src) reproducirConFade(st.volume ?? MAX_VOLUME);
  }
});
