(function(){
    // Базовый DPR при загрузке страницы (меняется при browser zoom)
    const BASE_DPR = window.devicePixelRatio || 1;
  
    function computeScale() {
      const dpr = window.devicePixelRatio || 1;
      const zoomFactor = dpr / BASE_DPR;
      return zoomFactor > 0 ? (1 / zoomFactor) : 1;
    }
  
    function applyScale() {
      const scale = computeScale();
      document.querySelectorAll('.center').forEach(el => {
        el.style.setProperty('--ui-scale', String(scale));
      });
    }
  
    document.addEventListener('DOMContentLoaded', applyScale);
    window.addEventListener('resize', applyScale);
  
    // Некоторые браузеры не всегда шлют resize при Ctrl+/Ctrl-
    setInterval(applyScale, 250);
  })();
  