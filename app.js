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
let iAmReady = false;

let powerValue = 0;
let powerDir = 1;
const powerSpeed = 1.5; 
let lastShotTime = 0;

const lobby = document.getElementById('lobby');
const gameArea = document.getElementById('gameArea');
const displayRoomCode = document.getElementById('displayRoomCode');
const p1ScoreEl = document.getElementById('p1Score');
const p2ScoreEl = document.getElementById('p2Score');
const timerEl = document.getElementById('timer');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const rematchOverlay = document.getElementById('rematchOverlay');
const winnerText = document.getElementById('winnerText');
const readyBtn = document.getElementById('readyBtn');
const readyText = document.getElementById('readyText');

document.getElementById('createBtn').addEventListener('click', () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    currentRoom = code;
    playerRole = 'p1';
    
    set(ref(db, 'rooms/' + code), {
        p1Score: 0,
        p2Score: 0,
        timer: 30, // Changed from 60 to 30
        status: 'waiting',
        p1Ready: false,
        p2Ready: false
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
            
            if(data.status === 'active') {
                rematchOverlay.style.display = 'none';
                iAmReady = false;
                readyBtn.style.display = 'block';
                readyText.innerText = '';
                
                // Clear balls when new 30s game starts
                if (data.timer === 30) {
                    activeBalls = [];
                    myScore = 0;
                }

                if (playerRole === 'p1' && !window.timerInterval) {
                    startTimer();
                }
            } else if (data.status === 'finished') {
                rematchOverlay.style.display = 'flex';
                
                if (data.p1Score > data.p2Score) {
                    winnerText.innerText = "PLAYER 1 WINS!";
                    winnerText.style.color = "#ff3333";
                } else if (data.p2Score > data.p1Score) {
                    winnerText.innerText = "PLAYER 2 WINS!";
                    winnerText.style.color = "#ff3333";
                } else {
                    winnerText.innerText = "IT'S A TIE!";
                    winnerText.style.color = "#00ffff";
                }

                const p1R = data.p1Ready || false;
                const p2R = data.p2Ready || false;

                if (iAmReady) {
                    readyBtn.style.display = 'none';
                    readyText.innerText = "Waiting for other player...";
                } else {
                    readyBtn.style.display = 'block';
                    readyText.innerText = "";
                }

                if (p1R && p2R && playerRole === 'p1') {
                    update(ref(db, 'rooms/' + currentRoom), {
                        p1Score: 0,
                        p2Score: 0,
                        timer: 30, // Reset to 30
                        p1Ready: false,
                        p2Ready: false,
                        status: 'active'
                    });
                }
            }
        }
    });
    
    if (!window.gameLoopRunning) {
        window.gameLoopRunning = true;
        requestAnimationFrame(gameLoop);
    }
}

readyBtn.addEventListener('click', () => {
    iAmReady = true;
    readyBtn.style.display = 'none';
    readyText.innerText = "Waiting for other player...";

    if (playerRole === 'p1') {
        update(ref(db, 'rooms/' + currentRoom), { p1Ready: true });
    } else {
        update(ref(db, 'rooms/' + currentRoom), { p2Ready: true });
    }
});

function startTimer() {
    window.timerInterval = setInterval(() => {
        let currentTimer = parseInt(timerEl.innerText);
        if(currentTimer > 0) {
            update(ref(db, 'rooms/' + currentRoom), { timer: currentTimer - 1 });
        } else {
            clearInterval(window.timerInterval);
            window.timerInterval = null; 
            update(ref(db, 'rooms/' + currentRoom), { status: 'finished' });
        }
    }, 1000);
}

class Ball {
    constructor(startX, startY, power) {
        this.x = startX;
        this.y = startY;
        this.radius = 15;
        this.gravity = 0.5;
        this.scored = false;
        this.playerOwner = playerRole;
        this.power = power;
        this.isPerfect = (power >= 60 && power <= 75);

        if (this.isPerfect) {
            this.vy = -19.5;
            this.vx = (Math.random() - 0.5) * 1.2; 
        } else if (power < 60) {
            this.vy = -13 - (power / 60) * 4; 
            this.vx = (Math.random() - 0.5) * 2.5;
        } else {
            this.vy = -21 - ((power - 75) / 25) * 4; 
            this.vx = (Math.random() - 0.5) * 3;
        }
    }

    update() {
        this.x += this.vx;
        this.vy += this.gravity;
        this.y += this.vy;

        const hoopX = this.playerOwner === 'p1' ? 200 : 600;
        const hoopY = 130;

        if (!this.isPerfect && this.power > 75 && this.vy > 0 && this.y > 60 && this.y < 140 && Math.abs(this.x - hoopX) < 60) {
            this.vy = -3; 
            this.vx = (this.x - hoopX > 0 ? 1 : -1) * (2 + Math.random() * 2);
            this.power = 0; 
        }
        
        if (!this.isPerfect && this.power < 60 && this.vy > 0 && Math.abs(this.x - hoopX) < 40 && Math.abs(this.y - hoopY) < 15) {
            this.vy = -2;
            this.vx = (Math.random() - 0.5) * 4;
            this.power = 0; 
        }

        if (!this.scored && this.isPerfect && Math.abs(this.x - hoopX) < 28 && Math.abs(this.y - hoopY) < 18 && this.vy > 0) {
            this.scored = true;
            
            // Check time dynamically during the shot to determine points
            const timeRemaining = parseInt(document.getElementById('timer').innerText);
            const pointsValue = (timeRemaining <= 10 && timeRemaining > 0) ? 3 : 1;
            
            myScore += pointsValue;
            
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

function shootBall(e) {
    if (e.cancelable) e.preventDefault(); 
    
    const timeRemaining = parseInt(timerEl.innerText);
    if(timeRemaining <= 0) return; 
    if(playerRole === 'p1' && timerEl.innerText === "30") return; 
    
    const now = Date.now();
    if (now - lastShotTime < 400) return; 
    lastShotTime = now;
    
    const startX = playerRole === 'p1' ? 200 : 600;
    const startY = 480; 
    
    activeBalls.push(new Ball(startX, startY, powerValue));
}

canvas.addEventListener('mousedown', shootBall);
canvas.addEventListener('touchstart', shootBall, { passive: false });

function drawHoop(ctx, x, y) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x - 75, y - 65, 150, 100, 10);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 25, y - 25, 50, 40);
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
    ctx.fillStyle = '#ff3333';
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 10;
    ctx.fillRect(x - 30, y + 5, 60, 8);
    ctx.shadowBlur = 0; 
}

function gameLoop() {
    const timeRemaining = parseInt(timerEl.innerText);
    const isWaitingForP2 = (playerRole === 'p1' && timeRemaining === 30);
    
    // Clear canvas with base color to prevent tearing during screen shake
    ctx.fillStyle = '#0f0f13';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save(); // Save context state before applying the shake

    // Apply Screen Shake if timer is 10 or less
    if (timeRemaining <= 10 && timeRemaining > 0 && !isWaitingForP2) {
        const shakeX = (Math.random() - 0.5) * 8;
        const shakeY = (Math.random() - 0.5) * 8;
        ctx.translate(shakeX, shakeY);
    }

    // Draw background slightly oversized to hide canvas edges during shake
    let bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, '#0f0f13');
    bgGradient.addColorStop(1, '#1a1a24');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(400, 500, 500, 100, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.stroke();

    drawHoop(ctx, 200, 120); 
    drawHoop(ctx, 600, 120); 

    activeBalls = activeBalls.filter(ball => ball.y < canvas.height + 50); 
    activeBalls.forEach(ball => {
        ball.update();
        ball.draw(ctx);
    });

    if (timeRemaining > 0 && !isWaitingForP2) {
        powerValue += powerDir * powerSpeed;
        if (powerValue >= 100) {
            powerValue = 100;
            powerDir = -1;
        } else if (powerValue <= 0) {
            powerValue = 0;
            powerDir = 1;
        }
    }

    ctx.fillStyle = '#222';
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.fillRect(250, 455, 300, 25);
    ctx.strokeRect(250, 455, 300, 25);
    ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.fillRect(250 + (300 * 0.60), 456, 300 * 0.15, 23);
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.fillRect(250 + (300 * (powerValue / 100)) - 3, 450, 6, 35);
    ctx.shadowBlur = 0;

    // Warning text color change during the last 10 seconds
    if (timeRemaining <= 10 && timeRemaining > 0 && !isWaitingForP2) {
        ctx.fillStyle = 'rgba(255, 50, 50, 1)';
        ctx.font = 'bold 22px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(`3-POINT MODE ACTIVE!`, canvas.width / 2, 435);
    } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 18px Courier New';
        ctx.textAlign = 'center';
        const statusText = isWaitingForP2 
            ? "Waiting for Player 2 to join..." 
            : `P${playerRole.toUpperCase()} - Stop the line in the GREEN!`;
        ctx.fillText(statusText, canvas.width / 2, 435);
    }

    ctx.restore(); // Restore context to stop the shake from affecting absolute positioning

    requestAnimationFrame(gameLoop);
}
