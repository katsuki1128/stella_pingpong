## Flask+Python+Herokuで環境構築してから何かをデプロイするまで
https://qiita.com/iBotamon/items/f40d7d233b8c9bf807ff

## 【Heroku】GitHub連携でFlaskアプリのデプロイ（コピペ用）
## gitignore参考
https://qiita.com/probabilityhill/items/be2bcdc10da9f5243693

## flask tailwind
```sh
cd /Users/k_katsuki/2024app/stella_pingpong
source venv/bin/activate 
python app.py


cd /Users/k_katsuki/2024app/stella_pingpong
source venv/bin/activate  
python socket_server.py

```

お名前.com VPSでWebSocketサーバー起動までの手順

1️⃣ お名前.com VPS 申し込み

お名前.com公式サイトにアクセス

VPSサービスを選び、プランを選択（最初は1GB or 2GBプランで十分）

OSは「Ubuntu 22.04 LTS」推奨

rootパスワードやSSH鍵設定を行い、申込み

2️⃣ VPS初期設定

メールに記載された内容を元に、お名前.com Naviにログイン

「VPS」→「コントロールパネル」から初期セットアップを実施

rootパスワードを設定し、VPSをアクティブ化

3️⃣ SSH接続

Macのターミナルから以下コマンドで接続

chmod 600 ~/2024app/stella_pingpong/vps102175093-001.pem
ssh -i ~/2024app/stella_pingpong/vps102175093-001.pem -p 10022 root@157.7.128.51

※ 初回接続時は「yes」と入力して続行

4️⃣ 必要パッケージのインストール

apt update && apt upgrade -y
apt install python3 python3-pip python3-venv git ufw -y

5️⃣ プロジェクトクローン＆セットアップ

GitHubから自分のWebSocketサーバーコードを取得

git clone https://github.com/katsuki1128/stella_pingpong.git
cd stella_pingpong

仮想環境の作成＆有効化

python3 -m venv venv
source venv/bin/activate

依存パッケージの修正（numpy==2.0.0 → numpy==1.24.4 など）

nano requirements.txt  # または vi / vim などで編集

修正後にインストール

pip install -r requirements.txt

6️⃣ ファイアウォール設定

ufw allow 5000
ufw allow 80
ufw allow 443
ufw enable

7️⃣ WebSocketサーバーの起動確認

python socket_server.py

正常に起動すれば：

 * Running on http://157.7.128.51:5001

8️⃣ 常時起動設定（systemd登録）

nano /etc/systemd/system/stella_websocket.service

内容：

[Unit]
Description=Stella Pingpong WebSocket Server
After=network.target

[Service]
WorkingDirectory=/root/stella_pingpong
ExecStart=/root/stella_pingpong/venv/bin/python /root/stella_pingpong/socket_server.py
Restart=always

[Install]
WantedBy=multi-user.target

保存後

systemctl daemon-reexec
systemctl daemon-reload
systemctl start stella_websocket
systemctl enable stella_websocket

ステータス確認

systemctl status stella_websocket

✅ スマホからアクセスするには？

WebSocketクライアント（例：controller.html）の io.connect() が http://157.7.128.51:5001 を指している必要あり

スマホブラウザで直接 http://157.7.128.51:5001 に接続可能

この後、必要であれば「controller.html（スマホ傾き送信用）」の例も作成しますのでリクエストしてください！

