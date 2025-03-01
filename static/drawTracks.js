// static/drawTracks.js

export const drawSatelliteTracks = (canvas, pathsFuture, currentTimeIndex, map) => {
    const ctx = canvas.getContext('2d');

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景色を設定
    ctx.fillStyle = '#001f3f'; // 深い藍色
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Leaflet 地図の経度範囲を取得
    const bounds = map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    // console.log(south, north)

    // 高度の範囲
    const minAltitude = 19000;
    const maxAltitude = 40000;
    const fukuokaLatitude = 33.5902;

    // 緯度に基づく比率と強度を計算する関数
    const calculateRatios = (latitude, fukuokaLatitude, north) => {
        const latitudeRatio = (latitude - fukuokaLatitude) / (north - fukuokaLatitude);
        const normRatio = 1 - Math.max(0, Math.min(1, latitudeRatio));

        return normRatio;
    };

    for (const path of Object.values(pathsFuture)) {

        ctx.beginPath();
        path.forEach((point, index) => {
            const x = (point.longitude - west) * (canvas.width / (east - west));

            // 高度と南北の範囲を組み合わせてy座標を計算
            const altitudeRatio = (point.altitude - minAltitude) / (maxAltitude - minAltitude);
            const yLatitude = (north - point.latitude) * (canvas.height / (north - south));
            const yAltitude = altitudeRatio * (canvas.height / 2);
            let y = (yLatitude + yAltitude) / 2;

            // arcの半径を福岡の緯度を基準に調整
            let arcRadiusX = 0;
            let arcRadiusY = 0;


            const normRatio = calculateRatios(point.latitude, fukuokaLatitude, north);

            if (point.latitude >= fukuokaLatitude) {
                // const { normalizedInverseRatio } = calculateRatios(point.latitude, fukuokaLatitude, north);
                arcRadiusX = 5 + 100 * normRatio;
                arcRadiusY = 5 + 25 * normRatio;

                // 福岡に近づくほどキャンバスの上部に配置
                const distanceToFukuokaRatio = (fukuokaLatitude - point.latitude) / (fukuokaLatitude - north);
                y = (distanceToFukuokaRatio * (canvas.height / 2)) + (altitudeRatio * (canvas.height / 2));
            } else {
                arcRadiusX = 0; // 福岡の緯度より南の場合は消す
                arcRadiusY = 0; // 福岡の緯度より南の場合は消す
            }

            // 緯度に基づいて黄色の色の濃さを計算
            // const normalizedInverseRatio = calculateRatios(point.latitude, fukuokaLatitude, north);
            // const yellowColor = `rgba(255, 255, 0, ${1 - normRatio})`;
            const yellowColor = `rgba(255, 255, 0, 1)`;


            if (arcRadiusX > 0 && arcRadiusY > 0) {
                ctx.strokeStyle = yellowColor;
                if (index === currentTimeIndex) {
                    // ctx.moveTo(x, y);
                    ctx.ellipse(x, y, arcRadiusX, arcRadiusY, 0, 0, 2 * Math.PI); // 楕円を描画
                } else if (index < currentTimeIndex) {
                    // ctx.lineTo(x, y);
                }
            }
        });
        ctx.stroke();
    }
};
