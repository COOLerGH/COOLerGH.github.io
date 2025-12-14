(function(){
  function isEmpty(str) {
    return (str || '').trim() === '';
  }

  function initNewRun(playerName) {
    localStorage.setItem('player_name', playerName);
    localStorage.setItem('level1_score', 0);
    localStorage.setItem('level2_score', 0);
    localStorage.setItem('level3_score', 0);
    localStorage.setItem('attempt1', 0);
    localStorage.setItem('attempt2', 0);
    localStorage.setItem('attempt3', 0);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const cvs = document.getElementById('canvas');
    const nameInput = document.getElementById('name');

    window.startGame = function(mode) {
      if (!nameInput || isEmpty(nameInput.value)) {
        alert('Нужно ввести имя!');
        return;
      }

      localStorage.setItem('mode', mode || 'normal');
      initNewRun(nameInput.value.trim());
      document.location.href = 'level1.html';
    };

    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode') || 'normal';
        window.startGame(mode);
      });
    });

    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') window.startGame('normal');
      });
    }

    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    function resizeCanvas() {
      cvs.width = window.innerWidth;
      cvs.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Фоновая анимация колец
    class Ring {
      constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.speed = Math.random() * 2 + 1;
      }

      update() {
        this.y += this.speed;
        if (this.y > cvs.height + this.radius) {
          this.y = -this.radius;
          this.x = Math.random() * cvs.width;
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 8;
        ctx.stroke();
        ctx.closePath();
      }
    }

    let rings = [];
    function initRings() {
      rings = [];
      for (let i = 0; i < 20; i++) {
        let radius = Math.random() * 40 + 20;
        let x = Math.random() * cvs.width;
        let y = Math.random() * cvs.height;
        let color = `hsl(${Math.random() * 360}, 70%, 60%)`;
        rings.push(new Ring(x, y, radius, color));
      }
    }

    initRings();

    function toRgbaTrail(colorStr) {
      if (!colorStr || typeof colorStr !== 'string') return 'rgba(0,0,0,0.10)';
      if (colorStr.startsWith('rgba(')) {
        const parts = colorStr.replace('rgba(', '').replace(')', '').split(',').map(s => s.trim());
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, 0.10)`;
      }
      if (colorStr.startsWith('rgb(')) return colorStr.replace(')', ', 0.10)').replace('rgb', 'rgba');
      return 'rgba(0,0,0,0.10)';
    }

    function animate() {
      const bgColor = getComputedStyle(document.body).backgroundColor;
      ctx.fillStyle = toRgbaTrail(bgColor);
      ctx.fillRect(0, 0, cvs.width, cvs.height);

      rings.forEach(ring => {
        ring.update();
        ring.draw();
      });

      requestAnimationFrame(animate);
    }

    animate();

    document.addEventListener('themeChanged', () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
    });
  });
})();
