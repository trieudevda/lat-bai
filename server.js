const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SCORES_FILE = path.join(__dirname, 'scores.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Khởi tạo file scores nếu chưa có
async function initScoresFile() {
    try {
        await fs.access(SCORES_FILE);
    } catch {
        await fs.writeFile(SCORES_FILE, JSON.stringify([]));
    }
}

// Đọc điểm từ file
async function readScores() {
    try {
        const data = await fs.readFile(SCORES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading scores:', error);
        return [];
    }
}

// Ghi điểm vào file
async function writeScores(scores) {
    try {
        await fs.writeFile(SCORES_FILE, JSON.stringify(scores, null, 2));
    } catch (error) {
        console.error('Error writing scores:', error);
    }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Lấy bảng xếp hạng
app.get('/api/scores', async (req, res) => {
    try {
        const scores = await readScores();
        const topScores = scores
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
        res.json(topScores);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch scores' });
    }
});

// Lưu điểm mới
app.post('/api/scores', async (req, res) => {
    try {
        const { name, score } = req.body;

        if (!name || typeof score !== 'number') {
            return res.status(400).json({ error: 'Invalid data' });
        }

        const scores = await readScores();
        scores.push({
            name: name.substring(0, 20), // Giới hạn độ dài tên
            score: score,
            date: new Date().toISOString()
        });

        await writeScores(scores);
        res.json({ success: true, message: 'Score saved' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save score' });
    }
});

// Xóa tất cả điểm (admin)
app.delete('/api/scores', async (req, res) => {
    try {
        await writeScores([]);
        res.json({ success: true, message: 'All scores deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete scores' });
    }
});

// Khởi động server
async function startServer() {
    await initScoresFile();
    app.listen(PORT, () => {
        console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
        console.log(`📊 API endpoint: http://localhost:${PORT}/api/scores`);
    });
}

startServer();
