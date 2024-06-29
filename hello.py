from flask import Flask

# 自分自身の名前をappという変数でインスタンス化
app = Flask(__name__)


@app.route("/")
def hello_world():
    return "Hello World!"


# コマンドラインで本ファイルを起動させたときの動作
if __name__ == "__main__":
    # 安全のため debug=False とする
    # 特に本番稼働するファイルでは debug=True としてはいけない!
    app.run(debug=False)
