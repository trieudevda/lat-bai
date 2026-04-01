// Cấu hình server
const SERVER_URL = 'http://localhost:3000'; // Thay đổi khi deploy

// Hệ thống âm thanh
const sounds = {
    flip: createSound([523.25, 659.25], 0.1, 'sine'),
    match: createSound([523.25, 659.25, 783.99], 0.2, 'sine'),
    wrong: createSound([220, 196], 0.3, 'sawtooth'),
    win: createSound([523.25, 659.25, 783.99, 1046.50], 0.4, 'sine'),
    lose: createSound([392, 349.23, 293.66], 0.5, 'triangle')
};

let soundEnabled = true;

function createSound(frequencies, duration, type = 'sine') {
    return () => {
        if (!soundEnabled) return;

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = 0.1;

        frequencies.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            oscillator.type = type;
            oscillator.frequency.value = freq;
            oscillator.connect(gainNode);

            const startTime = audioContext.currentTime + (index * duration / frequencies.length);
            oscillator.start(startTime);
            oscillator.stop(startTime + duration / frequencies.length);
        });

        setTimeout(() => audioContext.close(), duration * 1000 + 100);
    };
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('soundToggle').textContent = soundEnabled ? '🔊' : '🔇';
    localStorage.setItem('soundEnabled', soundEnabled);
}

// Khôi phục cài đặt âm thanh
const savedSound = localStorage.getItem('soundEnabled');
if (savedSound !== null) {
    soundEnabled = savedSound === 'true';
    document.getElementById('soundToggle').textContent = soundEnabled ? '🔊' : '🔇';
}

// Dữ liệu game
const gameData = {
    level1: [
        { chinese: '狗', image: '🐕', meaning: 'chó' },
        { chinese: '猫', image: '🐱', meaning: 'mèo' },
        { chinese: '鱼', image: '🐟', meaning: 'cá' },
        { chinese: '鸟', image: '🐦', meaning: 'chim' },
        { chinese: '花', image: '🌸', meaning: 'hoa' },
        { chinese: '树', image: '🌳', meaning: 'cây' }
    ],
    level2: [
        { chinese: '太阳', image: '☀️', meaning: 'mặt trời' },
        { chinese: '月亮', image: '🌙', meaning: 'mặt trăng' },
        { chinese: '星星', image: '⭐', meaning: 'ngôi sao' },
        { chinese: '房子', image: '🏠', meaning: 'nhà' },
        { chinese: '汽车', image: '🚗', meaning: 'ô tô' },
        { chinese: '飞机', image: '✈️', meaning: 'máy bay' },
        { chinese: '书', image: '📚', meaning: 'sách' },
        { chinese: '苹果', image: '🍎', meaning: 'táo' }
    ]
};

let playerName = '';
let currentLevel = 1;
let lives = 3;
let timeLeft = 30;
let timerInterval;
let flippedCards = [];
let matchedPairs = 0;
let canFlip = true;
let totalScore = 0;
let level1Time = 0;
let level2Time = 0;
let isOnline = false;

// API Functions
async function checkServerConnection() {
    try {
        const response = await fetch(`${SERVER_URL}/api/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        isOnline = response.ok;
        updateConnectionStatus();
        return isOnline;
    } catch (error) {
        isOnline = false;
        updateConnectionStatus();
        return false;
    }
}

function updateConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    if (isOnline) {
        statusEl.innerHTML = '<span class="online-indicator"></span>Kết nối server thành công';
    } else {
        statusEl.innerHTML = '<span class="online-indicator offline-indicator"></span>Chế độ offline (chỉ lưu local)';
    }
}

async function saveScoreToServer(name, score) {
    if (!isOnline) {
        saveScoreLocal(name, score);
        return;
    }

    try {
        const response = await fetch(`${SERVER_URL}/api/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score })
        });

        if (response.ok) {
            console.log('Điểm đã lưu lên server!');
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        console.log('Lỗi kết nối server, lưu local');
        saveScoreLocal(name, score);
    }
}

async function getLeaderboardFromServer() {
    if (!isOnline) {
        return getLeaderboardLocal();
    }

    try {
        const response = await fetch(`${SERVER_URL}/api/scores`);
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        console.log('Lỗi kết nối server, dùng dữ liệu local');
        return getLeaderboardLocal();
    }
}

// Local Storage Functions
function saveScoreLocal(name, score) {
    let leaderboard = JSON.parse(localStorage.getItem('leaderboard') || '[]');
    leaderboard.push({
        name: name,
        score: score,
        date: new Date().toLocaleDateString('vi-VN')
    });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10);
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
}

function getLeaderboardLocal() {
    return JSON.parse(localStorage.getItem('leaderboard') || '[]');
}

async function displayLeaderboard() {
    const leaderboard = await getLeaderboardFromServer();

    if (leaderboard.length === 0) {
        return '<p style="color: #999;">Chưa có người chơi nào. Hãy là người đầu tiên!</p>';
    }

    let html = '<ul class="leaderboard-list">';
    leaderboard.forEach((player, index) => {
        let rankClass = '';
        let medal = '';
        if (index === 0) {
            rankClass = 'top-1';
            medal = '🥇';
        } else if (index === 1) {
            rankClass = 'top-2';
            medal = '🥈';
        } else if (index === 2) {
            rankClass = 'top-3';
            medal = '🥉';
        } else {
            medal = `#${index + 1}`;
        }

        html += `
                    <li class="leaderboard-item ${rankClass}">
                        <span class="rank">${medal}</span>
                        <span class="player-info">${player.name}</span>
                        <span class="player-score">${player.score}</span>
                    </li>
                `;
    });
    html += '</ul>';
    return html;
}

function calculateScore() {
    const timeBonus = (level1Time + level2Time) * 10;
    const livesBonus = lives * 50;
    return timeBonus + livesBonus;
}

function startGame() {
    playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName) {
        alert('Vui lòng nhập tên của bạn!');
        return;
    }

    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    document.getElementById('playerNameDisplay').textContent = playerName;
    totalScore = 0;
    level1Time = 0;
    level2Time = 0;
    initLevel(1);
}

function initLevel(level) {
    currentLevel = level;
    lives = 3;
    timeLeft = 30;
    matchedPairs = 0;
    flippedCards = [];
    canFlip = true;

    document.getElementById('levelDisplay').textContent = level;
    document.getElementById('lives').textContent = lives;
    document.getElementById('timer').textContent = timeLeft;
    document.getElementById('scoreDisplay').textContent = totalScore;

    const data = level === 1 ? gameData.level1 : gameData.level2;
    createCards(data);
    startTimer();
}

function createCards(data) {
    const grid = document.getElementById('cardsGrid');
    grid.innerHTML = '';
    grid.className = `cards-grid level-${currentLevel}`;

    let cards = [];
    data.forEach((item, index) => {
        cards.push({ type: 'chinese', content: item.chinese, id: index });
        cards.push({ type: 'image', content: item.image, id: index });
    });

    cards = cards.sort(() => Math.random() - 0.5);

    cards.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.dataset.id = card.id;
        cardElement.dataset.type = card.type;
        cardElement.innerHTML = `
                    <div class="card-back">?</div>
                    <div class="card-front">${card.content}</div>
                `;
        cardElement.onclick = () => flipCard(cardElement);
        grid.appendChild(cardElement);
    });
}

function flipCard(card) {
    if (!canFlip || card.classList.contains('flipped') || card.classList.contains('matched')) {
        return;
    }

    sounds.flip();
    card.classList.add('flipped');
    flippedCards.push(card);

    if (flippedCards.length === 2) {
        canFlip = false;
        checkMatch();
    }
}

function checkMatch() {
    const [card1, card2] = flippedCards;
    const id1 = card1.dataset.id;
    const id2 = card2.dataset.id;

    setTimeout(() => {
        if (id1 === id2) {
            sounds.match();
            card1.classList.add('matched');
            card2.classList.add('matched');
            matchedPairs++;

            const totalPairs = currentLevel === 1 ? 6 : 8;
            if (matchedPairs === totalPairs) {
                clearInterval(timerInterval);
                if (currentLevel === 1) {
                    level1Time = timeLeft;
                } else {
                    level2Time = timeLeft;
                }
                levelComplete();
            }
        } else {
            sounds.wrong();
            card1.classList.add('wrong');
            card2.classList.add('wrong');
            lives--;
            document.getElementById('lives').textContent = lives;

            setTimeout(() => {
                card1.classList.remove('flipped', 'wrong');
                card2.classList.remove('flipped', 'wrong');
            }, 2000);

            if (lives === 0) {
                clearInterval(timerInterval);
                gameOver();
            }
        }

        flippedCards = [];
        canFlip = true;
    }, 800);
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').textContent = timeLeft;

        if (timeLeft === 0) {
            clearInterval(timerInterval);
            gameOver();
        }
    }, 1000);
}

async function levelComplete() {
    if (currentLevel === 1) {
        sounds.win();
        const levelScore = level1Time * 10;
        totalScore += levelScore;
        document.getElementById('scoreDisplay').textContent = totalScore;

        showCustomModal(
            '🎉 Xuất sắc!',
            `Bạn đã hoàn thành Level 1!<br><br>⏱️ Thời gian còn lại: ${level1Time}s<br>⭐ Điểm thưởng: +${levelScore}`,
            '',
            `<button onclick="continueToLevel2()">Chơi Level 2 →</button>`
        );
    } else {
        sounds.win();
        totalScore = calculateScore();
        await saveScoreToServer(playerName, totalScore);

        const leaderboardHTML = await displayLeaderboard();
        showCustomModal(
            '🏆 你真厉害！',
            `Chúc mừng ${playerName}!<br>Bạn đã hoàn thành tất cả!`,
            `<div class="final-score">⭐ Tổng điểm: ${totalScore}</div>` +
            '<div class="leaderboard"><h3>🏆 Bảng Xếp Hạng</h3>' + leaderboardHTML + '</div>',
            `<button onclick="playAgain()">🔄 Chơi lại</button>
                     <button onclick="backToHome()">🏠 Về trang chủ</button>`
        );
    }
}

function gameOver() {
    sounds.lose();
    showCustomModal(
        '😢 Thất bại',
        'Hết giờ hoặc hết mạng rồi!<br>Đừng bỏ cuộc, thử lại nhé!',
        '',
        `<button onclick="retryLevel()">🔄 Thử lại</button>
                 <button onclick="backToHome()">🏠 Về trang chủ</button>`
    );
}

function continueToLevel2() {
    hideModal();
    initLevel(2);
}

function retryLevel() {
    hideModal();
    initLevel(currentLevel);
}

function playAgain() {
    hideModal();
    location.reload();
}

function backToHome() {
    hideModal();
    location.reload();
}

async function showLeaderboardModal() {
    const leaderboardHTML = await displayLeaderboard();
    showCustomModal(
        '🏆 Bảng Xếp Hạng',
        '',
        '<div class="leaderboard">' + leaderboardHTML + '</div>',
        '<button onclick="hideModal()">Đóng</button>'
    );
}

function showCustomModal(title, message, extra, buttons) {
    document.getElementById('modalTitle').innerHTML = title;
    document.getElementById('modalMessage').innerHTML = message;
    document.getElementById('modalExtra').innerHTML = extra;
    document.getElementById('modalButtons').innerHTML = buttons;
    document.getElementById('modal').style.display = 'flex';
}

function hideModal() {
    document.getElementById('modal').style.display = 'none';
}

// Enter để bắt đầu
document.getElementById('playerNameInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        startGame();
    }
});

// Kiểm tra kết nối khi load trang
checkServerConnection();