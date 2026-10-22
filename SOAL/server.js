const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
let studentResults = [];

// Deteksi IP Wi-Fi / Hotspot Laptop Guru secara otomatis
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const server = http.createServer((req, res) => {
    // CORS agar HP Siswa bisa mengirim data dengan lancar
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // API Info IP Server untuk membuat QR Code otomatis
    if (req.url === '/api/info' && req.method === 'GET') {
        const ip = getLocalIP();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ip, port: PORT, url: `http://${ip}:${PORT}/` }));
    }

    // API Ambil & Kirim Nilai Siswa secara Real-time ke IFP
    if (req.url === '/api/results') {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(studentResults));
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => (body += chunk));
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    studentResults.unshift(data);
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok' }));
                } catch (e) {
                    res.writeHead(400);
                    res.end();
                }
            });
            return;
        }
        if (req.method === 'DELETE') {
            studentResults = [];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'cleared' }));
        }
    }

    // Layani file index.html
    let filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            return res.end('Pastikan file index.html berada di folder yang sama dengan server.js');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log('====================================================');
    console.log('🐦 ANGRY HOTS ACADEMY - SERVER KELAS AKTIF!');
    console.log(`🖥️ Buka di Laptop / IFP Guru : http://localhost:${PORT}`);
    console.log(`📱 Alamat HP Siswa (Wi-Fi)   : http://${ip}:${PORT}/?mode=student`);
    console.log('====================================================');
});
