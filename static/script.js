// static/script.js
import { drawSatelliteTracks } from './drawTracks.js';
const map = L.map('map').setView([33.5902, 130.4017], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// const map = L.map('map', {
//     crs: L.CRS.Simple, // シンプルな座標系を使用
//     minZoom: -5, // ズームレベルを調整
//     maxZoom: 2, // ズームレベルを調整
//     zoom: 2, // 初期ズームレベル
//     center: [5.5902, 130.4017] // 初期中心座標
// });



// 福岡を中心とした半径1633kmの円を描画
const fukuokaLatLng = [33.5902, 130.4017];
const radius = 6433000; // 半径1633kmをメートルに変換

const fukuokaCircle = L.circle(fukuokaLatLng, {
    color: 'green',
    fillColor: '#cce5ff',
    fillOpacity: 0.5,
    radius: radius
}).addTo(map)

// 画像のサイズを設定
const imageUrl = '/static/img/31640450_m.jpg';
const imageWidth = 1920; // 画像の幅
const imageHeight = 1280; // 画像の高さ

// 地図の中心を画像の中心に合わせるためのオフセットを計算
const centerLat = 5.5902;
const centerLng = 130.4017;
const imageBounds = [
    [centerLat - (imageHeight / 2) * 0.1, centerLng - (imageWidth / 2) * 0.1],
    [centerLat + (imageHeight / 2) * 0.1, centerLng + (imageWidth / 2) * 0.1]
];

// 画像を地図に追加
L.imageOverlay(imageUrl, imageBounds).addTo(map);

const currentPositions = JSON.parse(document.getElementById('current-positions').textContent);
const paths = JSON.parse(document.getElementById('paths').textContent);
const pathsFuture = JSON.parse(document.getElementById('paths-future').textContent);

const markers = {};

// 福岡に一番近い位置の人工衛星を特定する関数
const getClosestSatellite = (positions, targetLatLng) => {
    let closestSatellite = null;
    let minDistance = Infinity;

    positions.forEach(pos => {
        const distance = Math.sqrt(
            Math.pow(pos.latitude - targetLatLng[0], 2) +
            Math.pow(pos.longitude - targetLatLng[1], 2)
        );
        if (distance < minDistance) {
            minDistance = distance;
            closestSatellite = pos;
        }
    });

    return closestSatellite;
};

// 福岡に一番近い位置の人工衛星を特定
const closestSatellite = getClosestSatellite(currentPositions, fukuokaLatLng);


// アイコンのHTMLを生成する関数
const createIconHtml = (name, size, bgColorClass) => {
    return `
        <div class="satellite-label">
            <div class="satellite-icon ${bgColorClass}" style="font-size: ${size}px;"></div>
            ${name}
        </div>
    `;
};

// アイコンの大きさと背景色を変更する関数
const updateIconAppearance = (marker, inside, altitude) => {
    // console.log(`altitude: ${altitude}`);

    const size = inside ? 30 : 15; // 円の中は30px、外は15px
    const bgColorClass = inside ? 'satellite-icon-inside' : '';
    const iconHtml = createIconHtml(marker.options.title, size, bgColorClass);
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
    const iconHtml = createIconHtml(truncatedName, 15, '');
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
    if (pos === closestSatellite) {
        // 福岡に一番近い位置の人工衛星に対して特別な処理を行う
        const photoUrl = '/static/img/photo.jpg';
        const photoIcon = L.icon({
            iconUrl: photoUrl,
            iconSize: [50, 50], // アイコンのサイズを設定
            iconAnchor: [25, 25], // アイコンのアンカーを設定
            popupAnchor: [0, -25] // ポップアップのアンカーを設定
        });
        const marker = L.marker([pos.latitude, pos.longitude], { icon: photoIcon }).addTo(map);
        marker.bindPopup('Photo');
        markers[pos.satellite] = marker;
    } else {
        const marker = createMarker(pos);
        markers[pos.satellite] = marker;
        // アイコンの大きさと背景色を初期設定
        const inside = fukuokaCircle.getBounds().contains([pos.latitude, pos.longitude]);
        updateIconAppearance(marker, inside, pos.altitude);
    }
});

// パスを描画する関数
// const drawPaths = (paths, color) => {
//     for (const [satellite, path] of Object.entries(paths)) {
//         const latlngs = path.map(point => [point.latitude, point.longitude]);
//         const polyline = L.polyline(latlngs, { color: color }).addTo(map);
//         polyline.bindPopup(satellite);
//     }
// }

// 過去の航路を青色で表示
// drawPaths(paths, 'gray');

// 未来3時間の航路を黄色で表示
// drawPaths(pathsFuture, 'yellow');

// 再生ボタンをクリックしたときの動作
document.getElementById('playButton').addEventListener('click', () => {
    let currentTimeIndex = 0;
    const numSteps = pathsFuture[Object.keys(pathsFuture)[0]].length;
    const updateInterval = 100; // 1秒ごとに更新

    const updatePositions = () => {
        if (currentTimeIndex < numSteps) {
            for (const [satellite, path] of Object.entries(pathsFuture)) {
                const newPos = path[currentTimeIndex];
                markers[satellite].setLatLng([newPos.latitude, newPos.longitude]);
                const inside = fukuokaCircle.getBounds().contains([newPos.latitude, newPos.longitude]);
                updateIconAppearance(markers[satellite], inside, newPos.altitude);
            }
            // drawSatelliteTracks(canvas, pathsFuture, currentTimeIndex, map);
            currentTimeIndex++;
            setTimeout(updatePositions, updateInterval);
        }
    }

    updatePositions();
});

// const canvas = document.getElementById('satelliteCanvas');
// drawSatelliteTracks(canvas, pathsFuture, 0, map);

// 地図の範囲が変更されたときに再描画
// map.on('moveend', () => {
//     drawSatelliteTracks(canvas, pathsFuture, 0, map);
// });