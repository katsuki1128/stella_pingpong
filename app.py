# app.py
from flask import Flask, render_template, jsonify, request, url_for
import numpy as np
from skyfield.api import Topos, load
from datetime import datetime, timezone, timedelta
import os
import requests
import pickle
from geopy.distance import geodesic
from PIL import Image, ImageDraw, ImageFont
import requests
from io import BytesIO
import base64

app = Flask(__name__)

CACHE_FILE = "sats_within_range_cache.pkl"
CACHE_EXPIRATION = timedelta(hours=1)


# ========================================
# TLEファイルを取得（ローカルに存在しない場合はダウンロード）
# TLE(Two-Line Element)をローカルファイルから読み込む
# Two-Line Element set（TLE）は、人工衛星の軌道情報を表すための標準フォーマット。
# TLEは2行から成り立っており、それぞれの行が衛星の軌道パラメータを含んでいる。
# これにより、衛星の位置と速度を特定の時点で計算することができる。
# ========================================
def get_tle_file():
    # 現在の日付を取得
    today = datetime.now().strftime("%Y%m%d")
    tle_file_name = f"gnss_{today}.txt"

    # ファイルが存在するか確認
    if not os.path.exists(tle_file_name):
        # ファイルが存在しない場合、新規にダウンロード
        tle_url = "https://celestrak.org/NORAD/elements/gnss.txt"
        response = requests.get(tle_url)
        with open(tle_file_name, "wb") as file:
            file.write(response.content)
        print(f"TLE data downloaded: {tle_file_name}")
    else:
        print(f"Using local TLE file: {tle_file_name}")

    return tle_file_name


# ========================================
# 衛星の軌道データを取得し、
# そのデータから特定の時間における衛星の地上位置（緯度・経度）を計算して返す関数
# sat: 衛星オブジェクト。skyfieldライブラリを使用して取得した衛星の軌道データを含むオブジェクト
# times: 時間のリストまたは配列。これらの時間に対する衛星の位置を計算する
# ========================================
def get_satellite_path(sat, times):
    path = []
    geocentric_positions = sat.at(times)
    for pos in geocentric_positions:
        subpoint = pos.subpoint()
        path.append(
            {
                "latitude": subpoint.latitude.degrees,
                "longitude": subpoint.longitude.degrees,
                "altitude": subpoint.elevation.km,  # 高度を追加
            }
        )
    return path


# ========================================
# 指定された位置からの距離が範囲内かどうかをチェックする関数
# ========================================
def is_within_range(position, reference_position, range_km=1633):
    return geodesic(position, reference_position).kilometers <= range_km


def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "rb") as f:
            cache = pickle.load(f)
            cache_time = cache["timestamp"]
            if datetime.now(timezone.utc) - cache_time < CACHE_EXPIRATION:
                return cache["sats_within_range"]
    return None


def save_cache(sats_within_range):
    with open(CACHE_FILE, "wb") as f:
        cache = {
            "timestamp": datetime.now(timezone.utc),
            "sats_within_range": [sat.name for sat in sats_within_range],
        }
        pickle.dump(cache, f)


def get_time_ranges(ts):
    now = datetime.now(timezone.utc)
    current_time = ts.utc(
        now.year, now.month, now.day, now.hour, now.minute, now.second
    )

    start_time_past = current_time - timedelta(hours=0.5)
    end_time_future = current_time + timedelta(hours=12)
    num_points = 288
    times_past = ts.linspace(start_time_past, current_time, num_points)
    times_future = ts.linspace(current_time, end_time_future, num_points)

    return current_time, times_past, times_future


@app.route("/")
def input_page():
    return render_template("input.html")


@app.route("/upload_photo", methods=["POST"])
def upload_photo():
    data = request.json
    photo_data = data.get("photo").split(",")[1]  # Base64 データ部分を取得

    # Base64 データを画像に変換して保存
    photo = Image.open(BytesIO(base64.b64decode(photo_data)))
    photo_path = os.path.join(app.static_folder, "uploads/photo.jpg")
    photo.save(photo_path)

    return jsonify(
        {"photo_url": url_for("static", filename="uploads/photo.jpg", _external=True)}
    )


# ========================================
# 画像を作る関数
# ========================================
@app.route("/generate_image", methods=["POST"])
def generate_image():
    data = request.json
    name = data.get("name")
    small_text = data.get("small_text")
    photo_url = data.get("photo_url")
    print("photo_url", photo_url)

    # 背景画像を読み込む
    bg_image_path = os.path.join(app.static_folder, "img/bg_card.jpg")
    bg_image = Image.open(bg_image_path)

    # フォントを設定
    font_path = os.path.join(
        app.static_folder, "fonts/NotoSansJP-VariableFont_wght.ttf"
    )
    font = ImageFont.truetype(font_path, 24)
    small_font = ImageFont.truetype(font_path, 15)

    # 画像にテキストを描画
    draw = ImageDraw.Draw(bg_image)
    draw.text((100, 100), name, font=font, fill="black")
    draw.text((100, 150), small_text, font=small_font, fill="black")

    # 写真を読み込んで貼り付け
    response = requests.get(photo_url)
    photo = Image.open(BytesIO(response.content))
    photo = photo.resize((125, 125))
    bg_image.paste(photo, (100, 200))

    # 画像を保存
    output_path = os.path.join(app.static_folder, "output/generated_image.jpg")
    bg_image.save(output_path)

    return jsonify(
        {
            "image_url": url_for(
                "static", filename="output/generated_image.jpg", _external=True
            )
        }
    )


# ========================================
# 印刷する関数
# ========================================
@app.route("/print_image", methods=["POST"])
def print_image():
    data = request.json
    image_url = data.get("image_url")

    # Epson Connect APIのエンドポイント
    auth_url = (
        "https://api.epsonconnect.com/api/1/printing/oauth2/auth/token?subject=printer"
    )
    client_id = "24b814f980e049acac66a6bc05d3a611"
    client_secret = "bFrH4Cl6h0u8ewIwxju854FsQImy9ev1RacfkgH8K29i5w2GA0XFJn6ewZEWVbAz"
    printer_email = "HACKSONIC_EW-M973A3T@print.epsonconnect.com"

    # 認証
    auth_response = requests.post(
        auth_url,
        data={"grant_type": "password", "username": printer_email, "password": ""},
        headers={
            "Authorization": f'Basic {base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()}',
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )

    if auth_response.status_code != 200:
        return jsonify({"error": "Authentication failed"}), 400

    auth_data = auth_response.json()
    access_token = auth_data["access_token"]
    device_id = auth_data["subject_id"]

    # 印刷設定
    job_url = f"https://api.epsonconnect.com/api/1/printing/printers/{device_id}/jobs"
    job_response = requests.post(
        job_url,
        json={"job_name": "SpaceCowboy", "print_mode": "photo"},
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
    )

    if job_response.status_code != 201:
        return jsonify({"error": "Failed to create print job"}), 400

    job_data = job_response.json()
    job_id = job_data["id"]
    upload_uri = job_data["upload_uri"]

    # デバッグ用ログ出力
    print(f"Upload URI: {upload_uri}")
    print(f"Image URL: {image_url}")

    # 印刷ファイルのアップロード
    file_response = requests.post(
        upload_uri,
        headers={
            "Content-Length": str(len(requests.get(image_url).content)),
            "Content-Type": "application/octet-stream",
        },
        params={"Key": upload_uri.split("Key=")[-1], "File": "1.jpg"},
        data=requests.get(image_url).content,
    )

    # デバッグ用ログ出力
    print(f"File upload response status: {file_response.status_code}")
    print(f"File upload response content: {file_response.content}")

    if file_response.status_code != 200:
        return jsonify({"error": "Failed to upload print file"}), 400

    # 印刷の実行
    print_url = f"https://api.epsonconnect.com/api/1/printing/printers/{device_id}/jobs/{job_id}/print"
    print_response = requests.post(
        print_url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
    )

    if print_response.status_code != 200:
        return jsonify({"error": "Failed to execute print job"}), 400

    return jsonify(print_response.json())


@app.route("/map")
def map():
    # 柳川市の緯度経度
    yanagawa_lat = 33.1631
    yanagawa_lon = 130.3999
    yanagawa_position = (yanagawa_lat, yanagawa_lon)

    cached_sats_within_range = load_cache()
    tle_file_path = get_tle_file()
    sats = load.tle_file(tle_file_path)
    ts = load.timescale()
    current_time, times_past, times_future = get_time_ranges(ts)

    if cached_sats_within_range is not None:
        sats_within_range = [
            sat for sat in sats if sat.name in cached_sats_within_range
        ]
        print("Using cached data")
    else:
        print("Calculating new data")

        # 柳川の半径1633km以内を航行する衛星を検出
        sats_within_range = []

        # 柳川の半径1633km以内を航行する衛星を検出
        for sat in sats:
            within_range = False

            for time in times_past:
                subpoint = sat.at(time).subpoint()
                satellite_position = (
                    subpoint.latitude.degrees,
                    subpoint.longitude.degrees,
                )
                if is_within_range(satellite_position, yanagawa_position):
                    within_range = True
                    break

            if not within_range:
                for time in times_future:
                    subpoint = sat.at(time).subpoint()
                    satellite_position = (
                        subpoint.latitude.degrees,
                        subpoint.longitude.degrees,
                    )
                    if is_within_range(satellite_position, yanagawa_position):
                        within_range = True
                        break

            if within_range:
                sats_within_range.append(sat)

        save_cache(sats_within_range)

    current_positions = []
    paths_past = {}
    paths_future = {}

    for sat in sats_within_range:
        # 現在時刻における衛星の地上位置を取得
        subpoint = sat.at(current_time).subpoint()
        # 衛星の位置（緯度・経度）をタプルとして保存
        satellite_position = (subpoint.latitude.degrees, subpoint.longitude.degrees)

        # 衛星が200km以内にある場合、その位置情報をリストに追加
        current_positions.append(
            {
                "satellite": sat.name,
                "latitude": subpoint.latitude.degrees,
                "longitude": subpoint.longitude.degrees,
                "altitude": subpoint.elevation.km,  # 高度を追加
            }
        )
        # 過去の経路を取得し、辞書に保存
        paths_past[sat.name] = get_satellite_path(sat, times_past)
        # 未来の経路を取得し、辞書に保存
        paths_future[sat.name] = get_satellite_path(sat, times_future)

    return render_template(
        "map.html",
        current_positions=current_positions,
        paths=paths_past,
        paths_future=paths_future,
    )


@app.route("/controller")
def controller():
    return render_template("controller.html")


if __name__ == "__main__":
    app.run(debug=False)
