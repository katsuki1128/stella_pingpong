# socket_server.py
from flask import Flask, render_template
from flask_socketio import SocketIO
from socket_events import register_socket_events

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")


@app.route("/")
def index():
    return render_template("map.html")


@app.route("/controller")
def controller():
    return render_template("controller.html")


# イベント登録
register_socket_events(socketio)

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5001, debug=True)
