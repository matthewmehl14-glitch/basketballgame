import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCQptxDU5Oz3L_LiTOaUTg7Yvz0Gpk-sYg", /*[cite: 6] */
    authDomain: "basketball-b802a.firebaseapp.com", /*[cite: 6] */
    projectId: "basketball-b802a", /*[cite: 6] */
    storageBucket: "basketball-b802a.firebasestorage.app", /*[cite: 6] */
    messagingSenderId: "1013140828186", /*[cite: 6] */
    appId: "1:1013140828186:web:c18169ca8a6ff5822361a3", /*[cite: 6] */
    measurementId: "G-7WLD9B97QR" /*[cite: 6] */
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentRoom = null;
let playerRole = null; 
let myScore = 0;

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

canvas.addEventListener('mousedown', (e) => {
    const timeRemaining = parseInt(timerEl.innerText);
    if(timeRemaining <= 0) return; 
    if(playerRole === 'p1' && document.getElementById('timer').innerText === "60") return; 
    
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    if (y < 200) { 
        myScore++;
        
        if(playerRole === 'p1') {
            update(ref(db, 'rooms/' + currentRoom), { p1Score: myScore });
        } else {
            update(ref(db, 'rooms/' + currentRoom), { p2Score: myScore });
        }
    }
});

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(150, 100, 100, 10);
    ctx.fillRect(550, 100, 100, 10);

    ctx.fillStyle = 'white';
    ctx.strokeRect(125, 30, 150, 100); 
    ctx.strokeRect(525, 30, 150, 100);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '24px Courier';
    ctx.textAlign = 'center';
    
    const statusText = (playerRole === 'p1' && parseInt(timerEl.innerText) === 60) 
        ? "Waiting for Player 2 to join..." 
        : "Click the rim to score!";
        
    ctx.fillText(statusText, canvas.width / 2, 400);

    requestAnimationFrame(gameLoop);
}
