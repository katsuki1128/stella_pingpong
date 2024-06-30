# app.py
from flask import Flask, render_template
import numpy as np
from skyfield.api import Topos, load
from datetime import datetime, timezone, timedelta
import os
import requests
import pickle
from geopy.distance import geodesic

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
def index():
    # 福岡の緯度経度
    fukuoka_lat = 33.5902
    fukuoka_lon = 130.4017
    fukuoka_position = (fukuoka_lat, fukuoka_lon)

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

        # 福岡の半径1633km以内を航行する衛星を検出
        sats_within_range = []

        # 福岡の半径1633km以内を航行する衛星を検出
        for sat in sats:
            within_range = False

            for time in times_past:
                subpoint = sat.at(time).subpoint()
                satellite_position = (
                    subpoint.latitude.degrees,
                    subpoint.longitude.degrees,
                )
                if is_within_range(satellite_position, fukuoka_position):
                    within_range = True
                    break

            if not within_range:
                for time in times_future:
                    subpoint = sat.at(time).subpoint()
                    satellite_position = (
                        subpoint.latitude.degrees,
                        subpoint.longitude.degrees,
                    )
                    if is_within_range(satellite_position, fukuoka_position):
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


if __name__ == "__main__":
    app.run(debug=False)
