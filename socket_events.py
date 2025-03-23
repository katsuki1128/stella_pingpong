# socket_events.py
from flask_socketio import emit


def register_socket_events(socketio):
    @socketio.on("tilt_data")
    def handle_tilt(data):
        # スマホから受信した傾きデータをPC側にブロードキャスト
        emit("tilt_update", data, broadcast=True)
