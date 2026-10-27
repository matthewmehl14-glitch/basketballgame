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
let activeBalls = []; 

const lobby = document.getElementById('lobby');
const gameArea = document.getElementById('gameArea');
const displayRoomCode = document.getElementById('displayRoomCode');
const p1ScoreEl = document.getElementById('p1Score');
const p2ScoreEl = document.getElementById('p2Score');
const timerEl = document.getElementById('timer');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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

class Ball {
    constructor(startX, startY, targetX, targetY) {
        this.x = startX;
        this.y = startY;
        this.radius = 15;
        this.gravity = 0.5;
        this.scored = false;
        this.playerOwner = playerRole;

        // Physics calculation to land exactly at the mouse click location
        const framesToTarget = 40; 
        const dx = targetX - startX;
        const dy = targetY - startY;

        this.vx = dx / framesToTarget; 
        this.vy = (dy - 0.5 * this.gravity * framesToTarget * framesToTarget) / framesToTarget; 
    }

    update() {
        this.x += this.vx;
        this.vy += this.gravity;
        this.y += this.vy;

        // Hoop coordinates based on player role
        const hoopX = this.playerOwner === 'p1' ? 200 : 600;
        const hoopY = 130;

        // Collision detection for scoring (only registers when the ball is falling downward)
        if (!this.scored && Math.abs(this.x - hoopX) < 28 && Math.abs(this.y - hoopY) < 18 && this.vy > 0) {
            this.scored = true;
            myScore++;
            if(this.playerOwner === 'p1') {
                update(ref(db, 'rooms/' + currentRoom), { p1Score: myScore });
            } else {
                update(ref(db, 'rooms/' + currentRoom), { p2Score: myScore });
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#ff6600";
        ctx.fill();
        ctx.strokeStyle = "#331100";
        ctx.lineWidth = 1.5;
        ctx.stroke();

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
    if(playerRole === 'p1' && document.getElementById('timer').innerText === "60") return; 
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Start balls at the bottom center of the respective player's side
    const startX = playerRole === 'p1' ? 200 : 600;
    const startY = 480; 
    
    activeBalls.push(new Ball(startX, startY, clickX, clickY));
});

function drawHoop(ctx, x, y) {
    // Glass Backboard
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x - 75, y - 65, 150, 100, 10);
    ctx.fill();
    ctx.stroke();

    // Inner Target Square
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 25, y - 25, 50, 40);

    // Nylon Net
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 25, y + 10); ctx.lineTo(x - 15, y + 60);
    ctx.moveTo(x + 25, y + 10); ctx.lineTo(x + 15, y + 60);
    ctx.moveTo(x - 10, y + 10); ctx.lineTo(x, y + 60);
    ctx.moveTo(x + 10, y + 10); ctx.lineTo(x, y + 60);
    
    ctx.moveTo(x - 20, y + 25); ctx.lineTo(x + 20, y + 25);
    ctx.moveTo(x - 18, y + 40); ctx.lineTo(x + 18, y + 40);
    ctx.stroke();

    // Red Rim
    ctx.fillStyle = '#ff3333';
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 10;
    ctx.fillRect(x - 30, y + 5, 60, 8);
    ctx.shadowBlur = 0; // Reset shadow
}

function gameLoop() {
    // Draw Dark Arcade Background
    let bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, '#0f0f13');
    bgGradient.addColorStop(1, '#1a1a24');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Floor Curve
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(400, 500, 500, 100, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.stroke();

    // Draw Symmetrical Hoops
    drawHoop(ctx, 200, 120); // Player 1
    drawHoop(ctx, 600, 120); // Player 2

    // Update and Draw Balls
    activeBalls = activeBalls.filter(ball => ball.y < canvas.height + 50); 
    activeBalls.forEach(ball => {
        ball.update();
        ball.draw(ctx);
    });

    // Game UI overlays
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 20px Courier New';
    ctx.textAlign = 'center';
    
    const statusText = (playerRole === 'p1' && parseInt(timerEl.innerText) === 60) 
        ? "Waiting for Player 2 to join..." 
        : `YOU ARE P${playerRole.toUpperCase()} - Aim & Click to Shoot!`;
        
    ctx.fillText(statusText, canvas.width / 2, 455);

    requestAnimationFrame(gameLoop);
}
