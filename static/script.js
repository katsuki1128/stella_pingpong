// static/script.js
import { drawSatelliteTracks } from './drawTracks.js';
import { drawPingPongLine } from './pingpongLine.js';

// const socket = window.socket;
const socket = io.connect(location.origin);
console.log("socket", socket)

socket.on("tilt_update", (data) => {
    const tiltValue = data.gamma;
    // 倾き値に応じてラケット位置を更新（感度調整OK）
    racketX = (tiltValue + 90) / 180 * gameCanvas.width - racketWidth / 2;
    racketX = Math.max(0, Math.min(gameCanvas.width - racketWidth, racketX));
});

const map = L.map('map').setView([33.5902, 130.4017], 3);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const imageUrl = '/static/img/universe.jpg';
const imageBounds = [
    [-15, 55],
    [66, 210]
];

L.imageOverlay(imageUrl, imageBounds, {
    opacity: 1,
    zIndex: 5
}).addTo(map);

const currentPositions = JSON.parse(document.getElementById('current-positions').textContent);
const paths = JSON.parse(document.getElementById('paths').textContent);
const pathsFuture = JSON.parse(document.getElementById('paths-future').textContent);

const markers = {};
const targetSatelliteName = "QZS-1R (QZSS/PRN 196)";

let iconSize = { width: 42, height: 50 };

const updateIconAppearance = (marker) => {
    const size = 15;
    const iconHtml = `
        <div class="satellite-label">
            <div class="satellite-icon satellite-icon-inside" style="font-size: ${size}px;"></div>
            ${marker.options.title}
        </div>
    `;
    const customIcon = L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
    marker.setIcon(customIcon);
};

const createMarker = (pos) => {
    const truncatedName = pos.satellite.length > 7 ? pos.satellite.substring(0, 7) + '...' : pos.satellite;
    const iconHtml = `
        <div class="satellite-label">
            <div class="satellite-icon satellite-icon-inside" style="font-size: 15px;"></div>
            ${truncatedName}
        </div>
    `;
    const customIcon = L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: [15, 15],
        iconAnchor: [7.5, 7.5]
    });
    const marker = L.marker([pos.latitude, pos.longitude], { icon: customIcon, title: truncatedName }).addTo(map);
    marker.bindPopup(pos.satellite);
    return marker;
};

currentPositions.forEach(pos => {
    if (pos.satellite === targetSatelliteName) {
        const photoUrl = '/static/img/photo.jpg';
        const photoIconHtml = `
            <div class="circle-icon">
                <img src="${photoUrl}" style="width: 100%; height: 100%;">
            </div>
        `;
        const customIcon = L.divIcon({
            html: photoIconHtml,
            className: '',
            iconSize: [42, 50],
            iconAnchor: [21, 25],
            popupAnchor: [0, -25]
        });
        const marker = L.marker([pos.latitude, pos.longitude], { icon: customIcon }).addTo(map);
        marker.bindPopup('Photo');
        markers[pos.satellite] = marker;
    } else {
        const marker = createMarker(pos);
        markers[pos.satellite] = marker;
        updateIconAppearance(marker);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    window.mapInstance = map;
    window.pathsFutureForLine = pathsFuture;

    const canvas = document.getElementById('pingpong-line-canvas');
    drawPingPongLine(canvas, pathsFuture, 0, map);

    // ラケットとボールを描画・操作するロジック追加
    const gameCanvas = document.getElementById('pingpong-game-canvas');
    const gameCtx = gameCanvas.getContext('2d');
    gameCanvas.width = gameCanvas.clientWidth;
    gameCanvas.height = gameCanvas.clientHeight;

    let racketX = gameCanvas.width / 2 - 50;
    const racketWidth = 100;
    const racketHeight = 10;
    const ballRadius = 8;

    let ballX = gameCanvas.width / 2;
    let ballY = gameCanvas.height - 30;
    let ballDX = 2;
    let ballDY = -2;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') racketX -= 20;
        if (e.key === 'ArrowRight') racketX += 20;
        racketX = Math.max(0, Math.min(gameCanvas.width - racketWidth, racketX));
    });

    function drawRacket() {
        gameCtx.fillStyle = 'green';
        gameCtx.fillRect(racketX, gameCanvas.height - racketHeight - 10, racketWidth, racketHeight);
    }

    function drawBall() {
        gameCtx.beginPath();
        gameCtx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
        gameCtx.fillStyle = 'black';
        gameCtx.fill();
        gameCtx.closePath();
    }

    function drawGameFrame() {
        gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
        drawRacket();
        drawBall();

        // ピンポンラインのターゲット判定（ボールが衛星に当たったら跳ね返る）
        if (window.pingpongTargets) {
            for (const target of window.pingpongTargets) {
                if (Math.abs(ballX - target.x) < 10 && ballY <= target.y + ballRadius) {
                    ballDY = -ballDY;
                    break;  // 一度当たったら判定終了
                }
            }
        }

        // 壁＆ラケット反射
        if (ballX + ballDX > gameCanvas.width - ballRadius || ballX + ballDX < ballRadius) {
            ballDX = -ballDX;
        }
        if (ballY + ballDY > gameCanvas.height - racketHeight - 10 - ballRadius &&
            ballX > racketX && ballX < racketX + racketWidth) {
            ballDY = -ballDY;
        }

        // ⭐ 地図の下端では反射しないようにする
        // if (ballY + ballDY < ballRadius) ballDY = -ballDY;  // ←これを削除

        ballX += ballDX;
        ballY += ballDY;

        requestAnimationFrame(drawGameFrame);
    }


    drawGameFrame();
});

map.on('moveend', () => {
    const canvas = document.getElementById('pingpong-line-canvas');
    drawPingPongLine(canvas, pathsFuture, 0, map);
});

document.getElementById('playButton').addEventListener('click', () => {
    let currentTimeIndex = 0;
    const numSteps = pathsFuture[Object.keys(pathsFuture)[0]].length;
    const updateInterval = 50;

    const updatePositions = () => {
        if (currentTimeIndex < numSteps) {
            for (const [satellite, path] of Object.entries(pathsFuture)) {
                const newPos = path[currentTimeIndex];
                const marker = markers[satellite];
                if (satellite === targetSatelliteName) {
                    marker.setLatLng([newPos.latitude, newPos.longitude]);
                } else {
                    marker.setLatLng([newPos.latitude, newPos.longitude]);
                    updateIconAppearance(marker);
                }
            }
            const canvas = document.getElementById('pingpong-line-canvas');
            drawPingPongLine(canvas, pathsFuture, currentTimeIndex, map);

            currentTimeIndex++;
            setTimeout(updatePositions, updateInterval);
        }
    };

    updatePositions();
});

const ws = new WebSocket("wss://【ここにWebSocketサーバーURL】");
ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'tilt') {
        const tiltValue = data.value;  // -90 ~ +90
        // 倾きに応じてラケットを動かす（感度調整可能）
        racketX = (tiltValue + 90) / 180 * gameCanvas.width - racketWidth / 2;
        racketX = Math.max(0, Math.min(gameCanvas.width - racketWidth, racketX));
    }
});
