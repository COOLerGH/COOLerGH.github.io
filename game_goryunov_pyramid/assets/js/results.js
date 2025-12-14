var cvs = document.getElementById('canvas');
var ctx = cvs.getContext('2d');
let resetButton = document.getElementById('reset');
let saveButton = document.getElementById('save');

function resizeCanvas() {
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let playerName = localStorage.getItem('player_name') || '—';
let level1Score = parseInt(localStorage.getItem('level1_score')) || 0;
let level2Score = parseInt(localStorage.getItem('level2_score')) || 0;
let level3Score = parseInt(localStorage.getItem('level3_score')) || 0;
let totalScore = level1Score + level2Score + level3Score;

let a1 = parseInt(localStorage.getItem('attempt1')) || 0;
let a2 = parseInt(localStorage.getItem('attempt2')) || 0;
let a3 = parseInt(localStorage.getItem('attempt3')) || 0;

let mode = localStorage.getItem('mode') || 'normal';
let modeLabel = (mode === 'normal') ? 'Обычный' : (mode === 'two') ? 'Две Башни' : 'Перетаскивание';

document.getElementById('name').textContent = `Игрок: ${playerName}`;
document.getElementById('total').textContent = `Общий счет: ${totalScore} очков`;
document.getElementById('level1').textContent = `Уровень 1: ${level1Score} очков`;
document.getElementById('level2').textContent = `Уровень 2: ${level2Score} очков`;
document.getElementById('level3').textContent = `Уровень 3: ${level3Score} очков`;
document.getElementById('attempts').textContent = `Попыток (время вышло): ${a1 + a2 + a3} (1: ${a1}, 2: ${a2}, 3: ${a3})`;
document.getElementById('mode').textContent = `Режим: ${modeLabel}`;

function updateResultColors() {
    const isDarkTheme = document.getElementById('theme').href.includes('dark.css');
    const totalElement = document.getElementById('total');
    const nameElement = document.getElementById('name');

    if (isDarkTheme) {
        totalElement.style.backgroundColor = 'rgba(240, 244, 239, 0.1)';
        totalElement.style.color = '#f0f4ef';
        totalElement.style.border = '2px solid #f0f4ef';
        nameElement.style.color = '#f0f4ef';
    } else {
        totalElement.style.backgroundColor = 'rgba(86, 84, 140, 0.1)';
        totalElement.style.color = '#56548c';
        totalElement.style.border = '2px solid #56548c';
        nameElement.style.color = '#56548c';
    }
}

updateResultColors();
document.addEventListener('themeChanged', updateResultColors);

resetButton.onclick = function() {
    localStorage.setItem('level1_score', 0);
    localStorage.setItem('level2_score', 0);
    localStorage.setItem('level3_score', 0);
    localStorage.setItem('attempt1', 0);
    localStorage.setItem('attempt2', 0);
    localStorage.setItem('attempt3', 0);
    document.location.href = 'index.html';
};

saveButton.onclick = function() {
    let date = new Date();
    let day = date.getDate().toString().padStart(2, '0');
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let hours = date.getHours().toString().padStart(2, '0');
    let minutes = date.getMinutes().toString().padStart(2, '0');

    let data = `ИГРА "ПИРАМИДА"\n` +
        `========================\n` +
        `Игрок: ${playerName}\n` +
        `Режим: ${modeLabel}\n` +
        `Дата: ${day}.${month}.${date.getFullYear()} ${hours}:${minutes}\n` +
        `========================\n` +
        `Общий счет: ${totalScore} очков\n` +
        `Уровень 1: ${level1Score} очков (попыток: ${a1})\n` +
        `Уровень 2: ${level2Score} очков (попыток: ${a2})\n` +
        `Уровень 3: ${level3Score} очков (попыток: ${a3})\n` +
        `========================\n` +
        `Поздравляем с завершением игры!`;

    let blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `пирамида_${playerName}_${day}${month}_${hours}${minutes}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

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
for (let i = 0; i < 20; i++) {
    let radius = Math.random() * 40 + 20;
    let x = Math.random() * cvs.width;
    let y = Math.random() * cvs.height;
    let color = `hsl(${Math.random() * 360}, 70%, 60%)`;
    rings.push(new Ring(x, y, radius, color));
}

function animate() {
    const bodyStyle = getComputedStyle(document.body);
    const bgColor = bodyStyle.backgroundColor;

    ctx.fillStyle = bgColor.replace(')', ', 0.1)').replace('rgb', 'rgba');
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    rings.forEach(ring => {
        ring.update();
        ring.draw();
    });

    requestAnimationFrame(animate);
}

animate();
