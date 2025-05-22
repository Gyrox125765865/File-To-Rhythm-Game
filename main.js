const gameArea = document.getElementById('gameArea');
const arrowTypes = ['left', 'down', 'up', 'right'];
const arrowKeyMap = {
    left: ['ArrowLeft', 'a', 'A'],
    down: ['ArrowDown', 's', 'S'],
    up: ['ArrowUp', 'w', 'W'],
    right: ['ArrowRight', 'd', 'D']
};
let arrows = [];
let isPlaying = false;
let score = 0;
let combo = 0;
let maxCombo = 0;
let hitStats = { perfect: 0, good: 0, early: 0, miss: 0 };
const scoreDisplay = document.getElementById('score');
const comboDisplay = document.getElementById('combo');
const resultsDisplay = document.getElementById('results');
const bgVisual = document.getElementById('bg-visual');
function updateScore() {
    scoreDisplay.textContent = `Score: ${score}`;
}
function updateCombo() {
    comboDisplay.textContent = combo > 1 ? `Combo: ${combo}` : '';
    comboDisplay.style.textShadow = combo >= 10 ? '0 0 16px #0ff, 0 0 32px #0ff' : '';
}

// Audio and loading bar
const audioInput = document.getElementById('audioInput');
const audioPlayer = document.getElementById('audioPlayer');
const loadingBar = document.getElementById('loadingBar');
const loadingFill = document.getElementById('loadingFill');
const difficultySelect = document.getElementById('difficulty');
let audioLoaded = false;

// Sound effects
const hitSound = new Audio('https://cdn.jsdelivr.net/gh/terkelg/beat-hit@main/hit.wav');
const missSound = new Audio('https://cdn.jsdelivr.net/gh/terkelg/beat-hit@main/miss.wav');

// Beat detection variables
let beatTimes = [];
let filteredBeatTimes = [];
let beatIndex = 0;
let gameStartTime = 0;
let audioContext, buffer;
let arrowSpeed = 4;

// Classic glow VFX function
function showHitEffect(x, y, color, effectType = "normal") {
    const effect = document.createElement('div');
    effect.className = 'hit-effect';
    effect.style.left = `${x - 10}px`;
    effect.style.top = `${y - 10}px`;
    effect.style.background = color.bg;
    effect.style.borderColor = color.border;
    if (effectType === "perfect") {
        effect.classList.add('hit-perfect');
    } else if (effectType === "good") {
        effect.classList.add('hit-good');
    } else if (effectType === "early") {
        effect.classList.add('hit-early');
    }
    gameArea.appendChild(effect);
    setTimeout(() => {
        gameArea.removeChild(effect);
    }, 400);
}

// Arrow creation
function createArrow() {
    const type = arrowTypes[Math.floor(Math.random() * arrowTypes.length)];
    const arrow = document.createElement('div');
    arrow.className = `arrow ${type}`;
    arrow.dataset.type = type;
    const arrowXPositions = {
        left: 10,
        down: 120,
        up: 230,
        right: 340
    };
    arrow.style.left = `${arrowXPositions[type]}px`;
    arrow.style.top = `-40px`;
    arrow.style.zIndex = 2;
    gameArea.appendChild(arrow);
    arrows.push(arrow);
}

// Move arrows
function moveArrows() {
    for (let i = arrows.length - 1; i >= 0; i--) {
        const arrow = arrows[i];
        arrow.style.top = `${parseInt(arrow.style.top) + arrowSpeed}px`;
        if (parseInt(arrow.style.top) > 260) {
            // Missed arrow
            gameArea.removeChild(arrow);
            arrows.splice(i, 1);
            combo = 0;
            hitStats.miss++;
            updateCombo();
            missSound.currentTime = 0; missSound.play();
            gameArea.classList.add('shake');
            setTimeout(() => gameArea.classList.remove('shake'), 100);
            pulseBg('#f00');
        }
    }
}

// Beat detection using Web Audio API with loading bar
async function analyzeBeats(file) {
    beatTimes = [];
    loadingBar.style.display = 'block';
    loadingFill.style.width = '0';
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    buffer = await audioContext.decodeAudioData(arrayBuffer);

    // Simple energy-based beat detection
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const windowSize = 1024;
    const hopSize = 512;
    let prevEnergy = 0;
    const total = channelData.length - windowSize;
    for (let i = 0; i < total; i += hopSize) {
        let sum = 0;
        for (let j = 0; j < windowSize; j++) {
            sum += channelData[i + j] * channelData[i + j];
        }
        const energy = sum / windowSize;
        if (energy > prevEnergy * 1.3 && energy > 0.01) {
            beatTimes.push(i / sampleRate);
        }
        prevEnergy = energy;
        // Update loading bar
        if (i % (hopSize * 20) === 0) {
            loadingFill.style.width = `${Math.floor((i / total) * 100)}%`;
            await new Promise(r => setTimeout(r, 0)); // Let UI update
        }
    }
    loadingFill.style.width = '100%';
    setTimeout(() => { loadingBar.style.display = 'none'; }, 400);
}

// Handle audio file input and beat analysis
audioInput.addEventListener('change', async function() {
    const file = this.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        audioPlayer.src = url;
        audioLoaded = true;
        audioPlayer.load();
        await analyzeBeats(file);
        console.log('Detected beats:', beatTimes.length);
    }
});

// Spawn arrows at detected beats
function startGame() {
    if (isPlaying || !audioLoaded) return;
    isPlaying = true;
    score = 0;
    combo = 0;
    maxCombo = 0;
    hitStats = { perfect: 0, good: 0, early: 0, miss: 0 };
    updateScore();
    updateCombo();
    arrows.forEach(arrow => gameArea.contains(arrow) && gameArea.removeChild(arrow));
    arrows = [];
    beatIndex = 0;
    gameStartTime = performance.now();
    audioPlayer.currentTime = 0;
    resultsDisplay.style.display = 'none';

    // Difficulty logic
    const difficulty = difficultySelect.value;
    if (difficulty === "normal") {
        filteredBeatTimes = beatTimes.filter((_, i) => i % 3 === 0); // every 3rd beat
        arrowSpeed = 2;
    } else if (difficulty === "medium") {
        filteredBeatTimes = beatTimes.filter((_, i) => i % 2 === 0); // every 2nd beat
        arrowSpeed = 2.8;
    } else { // hard
        filteredBeatTimes = [...beatTimes];
        arrowSpeed = 4;
    }

    audioPlayer.play();
    requestAnimationFrame(beatGameLoop);
}

function beatGameLoop() {
    if (!isPlaying) return;
    const now = (performance.now() - gameStartTime) / 1000;
    // Spawn arrows at the right time
    while (beatIndex < filteredBeatTimes.length && filteredBeatTimes[beatIndex] <= now) {
        createArrow();
        beatIndex++;
        pulseBg('#0ff');
    }
    moveArrows();
    // End of song/results
    if (audioPlayer.ended || (beatIndex >= filteredBeatTimes.length && arrows.length === 0)) {
        showResults();
        isPlaying = false;
        return;
    }
    requestAnimationFrame(beatGameLoop);
}

// Background visualizer pulse
function pulseBg(color) {
    bgVisual.style.background = `radial-gradient(circle at 50% 50%, ${color} 0%, #222 100%)`;
    setTimeout(() => {
        bgVisual.style.background = `radial-gradient(circle at 50% 50%, #0ff 0%, #222 100%)`;
    }, 200);
}

// Results/stats screen
function showResults() {
    resultsDisplay.innerHTML = `
        <h2>Results</h2>
        <div>Score: <b>${score}</b></div>
        <div>Max Combo: <b>${maxCombo}</b></div>
        <div>Perfect: <b>${hitStats.perfect}</b></div>
        <div>Good: <b>${hitStats.good}</b></div>
        <div>Early: <b>${hitStats.early}</b></div>
        <div>Miss: <b>${hitStats.miss}</b></div>
        <button onclick="location.reload()">Restart</button>
    `;
    resultsDisplay.style.display = 'block';
}

// Stop game (optional, you can add a stop button if you want)
function stopGame() {
    isPlaying = false;
    audioPlayer.pause();
}

// Start button
document.getElementById('startBtn').addEventListener('click', startGame);

// Keydown event for scoring and VFX
document.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    let hit = false;
    const difficulty = difficultySelect.value;
    for (let i = 0; i < arrows.length; i++) {
        const arrow = arrows[i];
        if (arrowKeyMap[arrow.dataset.type].includes(e.key)) {
            const arrowTop = parseInt(arrow.style.top);

            // NORMAL (easiest): every 3rd beat, slow, wide windows
            if (difficulty === "normal") {
                if (arrowTop >= 255 && arrowTop <= 295) { // Perfect (green)
                    score += 100;
                    combo++;
                    hitStats.perfect++;
                    updateScore();
                    updateCombo();
                    showHitEffect(parseInt(arrow.style.left), 250, {bg: 'rgba(0,255,0,0.5)', border: '#00ff00'}, "perfect");
                    gameArea.removeChild(arrow);
                    arrows.splice(i, 1);
                    hit = true;
                    hitSound.currentTime = 0; hitSound.play();
                    pulseBg('#0f0');
                    break;
                } else if (arrowTop >= 235 && arrowTop < 255) { // Good (yellow)
                    score += 50;
                    combo++;
                    hitStats.good++;
                    updateScore();
                    updateCombo();
                    showHitEffect(parseInt(arrow.style.left), 250, {bg: 'rgba(255,255,0,0.5)', border: '#fff700'}, "good");
                    gameArea.removeChild(arrow);
                    arrows.splice(i, 1);
                    hit = true;
                    hitSound.currentTime = 0; hitSound.play();
                    pulseBg('#ff0');
                    break;
                } else if (arrowTop >= 205 && arrowTop < 235) { // Early (blue)
                    score += 25;
                    combo++;
                    hitStats.early++;
                    updateScore();
                    updateCombo();
                    showHitEffect(parseInt(arrow.style.left), 250, {bg: 'rgba(255, 0, 0, 0.5)', border: '#0080ff'}, "early");
                    gameArea.removeChild(arrow);
                    arrows.splice(i, 1);
                    hit = true;
                    hitSound.currentTime = 0; hitSound.play();
                    pulseBg('#08f');
                    break;
                }
            }
            // MEDIUM: every 2nd beat, medium speed, medium windows
            else if (difficulty === "medium") {
                if (arrowTop >= 255 && arrowTop <= 280) { // Perfect (green)
                    score += 100;
                    combo++;
                    hitStats.perfect++;
                    updateScore();
                    updateCombo();
                    showHitEffect(parseInt(arrow.style.left), 250, {bg: 'rgba(0,255,0,0.5)', border: '#00ff00'}, "perfect");
                    gameArea.removeChild(arrow);
                    arrows.splice(i, 1);
                    hit = true;
                    hitSound.currentTime = 0; hitSound.play();
                    pulseBg('#0f0');
                    break;
                } else if (arrowTop >= 235 && arrowTop < 255) { // Good (yellow)
                    score += 50;
                    combo++;
                    hitStats.good++;
                    updateScore();
                    updateCombo();
                    showHitEffect(parseInt(arrow.style.left), 250, {bg: 'rgba(255,255,0,0.5)', border: '#fff700'}, "good");
                    gameArea.removeChild(arrow);
                    arrows.splice(i, 1);
                    hit = true;
                    hitSound.currentTime = 0; hitSound.play();
                    pulseBg('#ff0');
                    break;
                } else if (arrowTop >= 220 && arrowTop < 235) { // Early (orange)
                    score += 25;
                    combo++;
                    hitStats.early++;
                    updateScore();
                    updateCombo();
                    showHitEffect(parseInt(arrow.style.left), 250, {bg: 'rgba(255,128,0,0.5)', border: '#ff8000'}, "early");
                    gameArea.removeChild(arrow);
                    arrows.splice(i, 1);
                    hit = true;
                    hitSound.currentTime = 0; hitSound.play();
                    pulseBg('#fa0');
                    break;
                }
            }
            // HARD: every beat, fast, tight windows
            else {
                if (arrowTop >= 260 && arrowTop <= 275) { // Perfect (green)
                    score += 100;
                    combo++;
                    hitStats.perfect++;
                    updateScore();
                    updateCombo();
                    showHitEffect(parseInt(arrow.style.left), 250, {bg: 'rgba(0,255,0,0.5)', border: '#00ff00'}, "perfect");
                    gameArea.removeChild(arrow);
                    arrows.splice(i, 1);
                    hit = true;
                    hitSound.currentTime = 0; hitSound.play();
                    pulseBg('#0f0');
                    break;
                } else if (arrowTop >= 245 && arrowTop < 260) { // Good (yellow)
                    score += 50;
                    combo++;
                    hitStats.good++;
                    updateScore();
                    updateCombo();
                    showHitEffect(parseInt(arrow.style.left), 250, {bg: 'rgba(255,255,0,0.5)', border: '#fff700'}, "good");
                    gameArea.removeChild(arrow);
                    arrows.splice(i, 1);
                    hit = true;
                    hitSound.currentTime = 0; hitSound.play();
                    pulseBg('#ff0');
                    break;
                } else if (arrowTop >= 230 && arrowTop < 245) { // Early (red)
                    score += 25;
                    combo++;
                    hitStats.early++;
                    updateScore();
                    updateCombo();
                    showHitEffect(parseInt(arrow.style.left), 250, {bg: 'rgba(255,0,0,0.5)', border: '#ff0000'}, "early");
                    gameArea.removeChild(arrow);
                    arrows.splice(i, 1);
                    hit = true;
                    hitSound.currentTime = 0; hitSound.play();
                    pulseBg('#f00');
                    break;
                }
            }
        }
    }
    // If no arrow was hit, penalize
    if (!hit) {
        combo = 0;
        hitStats.miss++;
        updateCombo();
        score -= 100;
        updateScore();
        missSound.currentTime = 0; missSound.play();
        gameArea.classList.add('shake');
        setTimeout(() => gameArea.classList.remove('shake'), 300);
        pulseBg('#f00');
    }
    if (combo > maxCombo) maxCombo = combo;
});