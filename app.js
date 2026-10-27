import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCQptxDU5Oz3L_LiTOaUTg7Yvz0Gpk-sYg",
    authDomain: "basketball-b802a.firebaseapp.com",
    projectId: "basketball-b802a",
    storageBucket: "basketball-b802a.firebasestorage.app",
    messagingSenderId: "1013140828186",
    appId: "1:1013140828186:web:c18169ca8a6ff5822361a3",
    measurementId: "G-7WLD9B97QR"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentRoom = null;
let playerRole = null; 
let myScore = 0;

// Game state for physics
let activeBalls = []; // Array to hold balls thrown on screen

const lobby = document.getElementById('lobby');
const gameArea = document.getElementById('gameArea');
const displayRoomCode = document.getElementById('displayRoomCode');
const p1ScoreEl = document.getElementById('p1Score');
const p2ScoreEl = document.getElementById('p2Score');
const timerEl = document.getElementById('timer');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Load Background Assets
const arcadeBG = new Image();
// Replace this with a direct path to an uploaded design or use our generated realistic arcade assets:
arcadeBG.src = 'https://i.ibb.co/68032Jg0/image-7.png'; // High-fidelity visual arcade skin

document.getElementById('createBtn').addEventListener('click', () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    currentRoom = code;
    playerRole = 'p1';
    
    set(ref(db, 'rooms/' + code), {
        p1Score: 0,
        p2Score: 0,
        timer: 60,
        status: 'waiting'
    });

    startGameUI(code);
});

document.getElementById('joinBtn').addEventListener('click', () => {
    const code = document.getElementById('roomCode').value;
    if(code.length === 4) {
        currentRoom = code;
        playerRole = 'p2';
        
        update(ref(db, 'rooms/' + code), { status: 'active' });
        startGameUI(code);
    } else {
        alert("Please enter a valid 4-digit code.");
    }
});

function startGameUI(code) {
    lobby.style.display = 'none';
    gameArea.style.display = 'block';
    displayRoomCode.innerText = code;

    onValue(ref(db, 'rooms/' + code), (snapshot) => {
        const data = snapshot.val();
        if(data) {
            p1ScoreEl.innerText = data.p1Score;
            p2ScoreEl.innerText = data.p2Score;
            timerEl.innerText = data.timer;
            
            if(data.status === 'active' && playerRole === 'p1' && !window.timerInterval) {
                startTimer();
            }
        }
    });

    requestAnimationFrame(gameLoop);
}

function startTimer() {
    window.timerInterval = setInterval(() => {
        let currentTimer = parseInt(timerEl.innerText);
        if(currentTimer > 0) {
            update(ref(db, 'rooms/' + currentRoom), { timer: currentTimer - 1 });
        } else {
            clearInterval(window.timerInterval);
            update(ref(db, 'rooms/' + currentRoom), { status: 'finished' });
        }
    }, 1000);
}

// -- BALL PHYSICS --
class Ball {
    constructor(startX, startY, targetX, targetY) {
        this.x = startX;
        this.y = startY;
        this.radius = 14;
        
        // Shoot calculations (trajectory towards hoop)
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        this.vx = (dx / distance) * 9; 
        this.vy = -14; // Arc velocity
        this.gravity = 0.45;
        this.scored = false;
        this.targetHoopX = targetX;
    }

    update() {
        this.x += this.vx;
        this.vy += this.gravity;
        this.y += this.vy;

        // Collision Check (Score detection area)
        // P1 Hoop ~ 340, 165; P2 Hoop ~ 620, 165
        const hoopY = 165;
        const hoopX = this.targetHoopX;

        if (!this.scored && Math.abs(this.x - hoopX) < 25 && Math.abs(this.y - hoopY) < 15 && this.vy > 0) {
            this.scored = true;
            myScore++;
            if(playerRole === 'p1') {
                update(ref(db, 'rooms/' + currentRoom), { p1Score: myScore });
            } else {
                update(ref(db, 'rooms/' + currentRoom), { p2Score: myScore });
            }
        }
    }

    draw(ctx) {
        // Draw real-looking basketball with lines
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#ff6600";
        ctx.fill();
        ctx.strokeStyle = "#331100";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Ball seam/grip curves for realism
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, -Math.PI / 4, Math.PI / 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, Math.PI * 0.75, Math.PI * 1.25);
        ctx.stroke();
        ctx.restore();
    }
}

canvas.addEventListener('mousedown', (e) => {
    const timeRemaining = parseInt(timerEl.innerText);
    if(timeRemaining <= 0) return; 
    if(playerRole === 'p1' && document.getElementById('timer').innerText === "60") return; // Wait for P2
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Limit players to shooting only on their side's hoop (P1: left, P2: right)
    let startX, targetX;
    if (playerRole === 'p1') {
        startX = 180;
        targetX = 368; // Player 1 Hoop Target
    } else {
        startX = 620;
        targetX = 633; // Player 2 Hoop Target
    }
    
    // Create new physics-based projectile and fire it
    activeBalls.push(new Ball(startX, 400, targetX, 165));
});

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Backboard / Cage arcade machine interface
    if (arcadeBG.complete) {
        ctx.drawImage(arcadeBG, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Update and Draw Live Shootout Physics
    activeBalls = activeBalls.filter(ball => ball.y < canvas.height + 50); // Clean up out-of-bounds balls
    activeBalls.forEach(ball => {
        ball.update();
        ball.draw(ctx);
    });

    // Game UI overlays
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '20px Courier New';
    ctx.textAlign = 'center';
    
    const statusText = (playerRole === 'p1' && parseInt(timerEl.innerText) === 60) 
        ? "Waiting for Player 2 to join..." 
        : `YOU ARE P${playerRole.toUpperCase()} - Shoot to Score!`;
        
    ctx.fillText(statusText, canvas.width / 2, 455);

    requestAnimationFrame(gameLoop);
}
