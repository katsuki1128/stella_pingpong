// static/pingpongLine.js

export const drawPingPongLine = (canvas, pathsFuture, currentTimeIndex, map) => {
    const ctx = canvas.getContext('2d');

    // キャンバスサイズ設定
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    // 背景をクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 現在の地図の経度範囲を取得
    const bounds = map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();

    // y座標は固定（ライン上）
    const y = 20;
    window.pingpongTargets = []; // 当たり判定用にリセット

    // 衛星を経度ベースで描画
    for (const [satellite, path] of Object.entries(pathsFuture)) {
        const pos = path[currentTimeIndex];
        if (!pos) continue;

        // 経度をmap範囲に合わせてX座標に変換
        const x = (pos.longitude - west) * (canvas.width / (east - west));

        // 衛星アイコンを描画
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();

        // 名前ラベル描画
        ctx.font = '10px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(satellite.substring(0, 6), x, y - 12);

        // 当たり判定用に保存
        window.pingpongTargets.push({ x: x, y: y });
    }
};

// リサイズ時の再描画対応
window.addEventListener('resize', () => {
    const canvas = document.getElementById('pingpong-line-canvas');
    if (canvas && window.currentPositionsForLine && window.mapInstance) {
        drawPingPongLine(canvas, window.pathsFutureForLine, 0, window.mapInstance);
    }
});