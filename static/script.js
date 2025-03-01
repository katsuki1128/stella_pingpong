// static/script.js
import { drawSatelliteTracks } from './drawTracks.js';
const map = L.map('map').setView([33.5902, 130.4017], 3);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// 画像のサイズを設定
const imageUrl = '/static/img/universe.jpg';
// 福岡の座標を中心に
const centerLat = 33.5902;
const centerLng = 130.4017;

// 画像の範囲を設定
const latSpread = 80; // 南北に20度の範囲
const lngSpread = 150; // 東西に30度の範囲

// const imageBounds = [
//     [centerLat - latSpread / 2, centerLng - lngSpread / 2], // 左下
//     [centerLat + latSpread / 2, centerLng + lngSpread / 2]  // 右上
// ];


const imageBounds = [
    [-15, 55], // 左下
    [66, 210]  // 右上
];

console.log("imageBounds", imageBounds)

// 画像をマップに追加
L.imageOverlay(imageUrl, imageBounds, {
    opacity: 1,
    zIndex: 5
}).addTo(map);

// const imageWidth = 1920; // 画像の幅
// const imageHeight = 1280; // 画像の高さ

// // 縮尺係数を調整
// const scaleFactor = 0.1;

// // 横方向の伸縮率（1.0より大きい値で横に伸びる）
// const horizontalStretch = 1.55; // 横に1.5倍に伸ばす

// // 地図の中心を画像の中心に合わせる
// const centerLat = 33.5902;
// const centerLng = 130.4017;

// // アスペクト比を調整して緯度・経度範囲を計算
// const latRange = imageHeight * scaleFactor;
// const lngRange = imageWidth * scaleFactor * horizontalStretch; // 横方向を伸ばす

// // const imageBounds = [
// //     [centerLat - latRange / 2, centerLng - lngRange / 2],
// //     [centerLat + latRange / 2, centerLng + lngRange / 2]
// // ];

// const imageBounds = [[-40, -18], [87, 279]];

// console.log("imageBounds", imageBounds)

// // 画像を地図に追加
// L.imageOverlay(imageUrl, imageBounds).addTo(map);

const currentPositions = JSON.parse(document.getElementById('current-positions').textContent);
const paths = JSON.parse(document.getElementById('paths').textContent);
const pathsFuture = JSON.parse(document.getElementById('paths-future').textContent);

const markers = {};

// 特定の衛星名
const targetSatelliteName = "QZS-1R (QZSS/PRN 196)";


// アイコンの大きさと背景色を変更する関数
const updateIconAppearance = (marker) => {
    const size = 15; // 円の中は30px、外は15px

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

// マーカーを作成する関数
const createMarker = (pos) => {
    const truncatedName = pos.satellite.length > 7 ? pos.satellite.substring(0, 7) + '...' : pos.satellite;
    // const iconHtml = createIconHtml(truncatedName, 15, '');
    const iconHtml = `
        <div class="satellite-label">
            <div class="satellite-icon satellite-icon-inside" style="font-size: 15px;"></div>
            ${truncatedName}
        </div>
    `;
    const customIcon = L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: [15, 15], // 初期は小さいサイズ
        iconAnchor: [7.5, 7.5]
    });
    const marker = L.marker([pos.latitude, pos.longitude], { icon: customIcon, title: truncatedName }).addTo(map);
    marker.bindPopup(pos.satellite);
    return marker;
};

// 初期マーカーの設定
currentPositions.forEach(pos => {
    if (pos.satellite === targetSatelliteName) {
        // 特定の衛星に対して特別な処理を行う
        const photoUrl = '/static/img/photo.jpg';
        const photoIconHtml = `
            <div class="circle-icon">
                <img src="${photoUrl}" style="width: 100%; height: 100%;">
            </div>
        `;
        const customIcon = L.divIcon({
            html: photoIconHtml,
            className: '',
            iconSize: [42, 50], // アイコンのサイズを設定
            iconAnchor: [21, 25], // アイコンのアンカーを設定
            popupAnchor: [0, -25] // ポップアップのアンカーを設定
        });
        const marker = L.marker([pos.latitude, pos.longitude], { icon: customIcon }).addTo(map);
        marker.bindPopup('Photo');
        markers[pos.satellite] = marker;
    } else {
        const marker = createMarker(pos);
        markers[pos.satellite] = marker;
        // アイコンの大きさと背景色を初期設定
        updateIconAppearance(marker);
    }
});

// 再生ボタンをクリックしたときの動作
document.getElementById('playButton').addEventListener('click', () => {
    let currentTimeIndex = 0;
    const numSteps = pathsFuture[Object.keys(pathsFuture)[0]].length;
    const updateInterval = 10; // 1秒ごとに更新

    const updatePositions = () => {
        if (currentTimeIndex < numSteps) {
            for (const [satellite, path] of Object.entries(pathsFuture)) {
                const newPos = path[currentTimeIndex];
                const marker = markers[satellite];
                if (satellite === targetSatelliteName) {
                    // 福岡に一番近い位置の人工衛星のアイコンを変更しない
                    marker.setLatLng([newPos.latitude, newPos.longitude]);
                } else {
                    marker.setLatLng([newPos.latitude, newPos.longitude]);
                    // const inside = fukuokaCircle.getBounds().contains([newPos.latitude, newPos.longitude]);
                    updateIconAppearance(marker);
                }
            }
            currentTimeIndex++;
            setTimeout(updatePositions, updateInterval);
        }
    }

    updatePositions();
});


// スライダーのイベントリスナーを追加
document.getElementById('slider').addEventListener('input', (event) => {
    const sliderValue = event.target.value;
    const numSteps = pathsFuture[Object.keys(pathsFuture)[0]].length;
    const stepIndex = Math.floor((sliderValue / 200) * numSteps);

    let closestDistance = Infinity;
    let closestTimeIndex = -1;

    for (const [satellite, path] of Object.entries(pathsFuture)) {
        const newPos = path[stepIndex];
        const marker = markers[satellite];
        if (satellite === targetSatelliteName) {
            // 特定の衛星のアイコンを変更しない
            marker.setLatLng([newPos.latitude, newPos.longitude]);

            // 福岡との距離を再計算して表示
            const satelliteLatLng = [newPos.latitude, newPos.longitude];
            const distance = haversineDistance(fukuokaLatLng, satelliteLatLng);
            // console.log(`Distance between Fukuoka and ${targetSatelliteName}: ${distance.toFixed(2)} km`);
            document.getElementById('distanceDisplay').innerText = `推しとの距離: ${Math.round(distance)}  km`;

            // 最も近い時点を特定
            if (distance < closestDistance) {
                closestDistance = distance;
                closestTimeIndex = stepIndex;
            }

        } else {
            marker.setLatLng([newPos.latitude, newPos.longitude]);
            updateIconAppearance(marker);
        }
    }
    // 最も近い時点の日時とそれまでの時間を計算して表示
    if (closestTimeIndex !== -1) {
        const closestTime = new Date(Date.now() + (closestTimeIndex * (24 * 60 * 60 * 1000 / numSteps)));
        const now = new Date();
        const timeDiff = closestTime - now;
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        document.getElementById('closestApproach').innerText = `最も近づく日時: ${closestTime.toLocaleString()} (あと ${hours}時間${minutes}分) 距離: ${Math.round(closestDistance)} km`;
    }
});

// Haversine 公式を使用して2点間の距離を計算する関数
const haversineDistance = (coords1, coords2) => {
    const toRad = (x) => x * Math.PI / 180;

    const lat1 = coords1[0];
    const lon1 = coords1[1];
    const lat2 = coords2[0];
    const lon2 = coords2[1];

    const R = 6371; // 地球の半径（キロメートル）

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    return d;
};

const fukuokaLatLng = [33.5902, 130.4017]; // 福岡の位置


// 衛星の位置を取得
const targetSatellitePosition = currentPositions.find(pos => pos.satellite === targetSatelliteName);

if (targetSatellitePosition) {
    const satelliteLatLng = [targetSatellitePosition.latitude, targetSatellitePosition.longitude];
    const distance = haversineDistance(fukuokaLatLng, satelliteLatLng);
    console.log(`Distance between Fukuoka and ${targetSatelliteName}: ${distance.toFixed(2)} km`);
} else {
    console.log(`${targetSatelliteName} not found in currentPositions`);
}