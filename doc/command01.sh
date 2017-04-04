#!/bin/sh

#Herokuログイン
heroku login

#プロジェクトのディレクトリに移動
#もうディレクトリ内なら不要
#cd <app-path>
#たとえば
#cd ~/work/chat

#gitを始めるコマンド
#git init

#全部のファイルをgitに認識させる（ステージに上げる）
git add .

#コミット
git commit -m "comment"

#herokuのリモートレポジトリを作成（アプリが作られる）
heroku create
