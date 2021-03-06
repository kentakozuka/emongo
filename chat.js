/******************************
 * チャット
 *****************************/
var express			= require('express');
var app				= express();
var http			= require('http').Server(app);
var io				= require('socket.io')(http);
var mongo_client	= require('mongodb').MongoClient;
var bot				= require('./chat-server-bot.js');
var PORT			= process.env.PORT || 8080;


// MongoDBの接続情報を保持する変数
// (nullで初期化してからco_messagesを代入)
var mongo_db = null, co_messages;


// MongoDBへ接続
// herokuの環境変数にDBのURIが設定されている
// heroku config
mongo_client.connect(process.env.MONGODB_URI, function (err, db) {
	// エラーチェック
	if (err) {
		console.log("DB error", err);
	}
	// 接続情報を記録
	mongo_db = db;
	// コレクションを取得
	co_messages = db.collection('co_messages');
});

//ユーザ数を格納するグローバル変数
var userCnt = {
		a			: 0,
		b			: 0,
		kenta_bot	: 0
	}


//ルートディレクトリにアクセスした時に動く処理
app.get('/', function(req, res) {
	//index.htmlに遷移する
	res.sendFile(__dirname + '/index.html');
});

//socket.ioに接続された時に動く処理
io.on('connection', function(socket) {

	//debug
	console.log('%s さんが接続しました。', socket.id);

	//デフォルトのチャンネル
	var channel = 'A';
	//Roomを初期化
	socket.join(channel);
	//アクセス時はデフォルトのチャンネルなので、そのユーザをカウント
	userCnt.a++;
	//全ユーザ上のユーザ数を更新
	io.emit('user cnt', userCnt);
	
	/*
	 * コレクションから検索
	 * 指定するときは
	 * .find({key:org})
	 */
	co_messages
	.find()
	.toArray(function(err, rows) {
		if(err) {};
		//「ようこそ」と「ID」を自分の画面だけに表示
		socket.emit('welcome', rows);
		socket.emit('get id', socket.id);
	
		//接続時に同じチャンネルの人に入室を伝える
		socket.broadcast.to(channel).emit('message', socket.id + 'さんが入室しました！', 'system'); 
	});

	/**
	 * 'message'イベント関数
	 * 同じチャンネルの人にメッセージを送る
	 * @param	String	msg	ユーザが送信したメッセージ
	 **/
	socket.on('message', function(msg) {
		console.log(channel);
		//kenta_botのとき
		if(channel == 'kenta_bot') {
			//Botクラスの関数の呼び出し
			bot.getResponse(msg, function(bot_msg) {
				//body = JSON.stringify({"msg": bot_msg});
				//同じチャンネルの人に送信
				io.sockets.in(channel).emit('message', bot_msg, 'ボット');
			});
		} else {
			//同じチャンネルの人に送信
			io.sockets.in(channel).emit('message', msg, socket.id);
		}

		co_messages
		.insert({
				user_id		: socket.id
				//commentからmessageにキーを変更
			,	message		: msg
		});
	});
	
	/**
	 * 'disconnect'イベント関数
	 * 接続が切れた時に動く
	 * 接続が切れたIDを全員に表示
	 * @param	String	e
	 **/
	socket.on('disconnect', function(e) {
		console.log('%s さんが退室しました。', socket.id);
		if (channel === 'A') {
			userCnt.a--;
	
		} else {
			userCnt.b--;
		}
		//アクティブユーザを更新
		io.emit('user cnt', userCnt);
	});
	
	/**
	 * 'disconnect'イベント関数
	 * チャンネルを変えた時に動く
	 * 今いるチャンネルを出て、選択されたチャンネルに移動する
	 * @param	String	e
	 **/
	socket.on('change channel', function(newChannel) {
		//ルーム内の自分以外
		socket.broadcast.to(channel).emit('message', socket.id + 'さんが退室しました！', 'system');
		if (newChannel === 'A') {
			++userCnt.a;
			if (userCnt.b > 0) {
				--userCnt.b;
			}
		} else {
			++userCnt.b;
			if (userCnt.a > 0) {
				--userCnt.a;
			}
		}
		io.emit('user cnt', userCnt);
		//チャンネルを去る
		socket.leave(channel); 
		//選択された新しいチャンネルのルームに入る
		socket.join(newChannel); 
		//今いるチャンネルを保存
		channel = newChannel; 
		//チャンネルを変えたこと自分に送信
		socket.emit('change channel', channel); 
		//ルーム内の自分以外
		socket.broadcast.to(channel).emit('message', socket.id + 'さんが入室しました！', 'system');
	});
});

//接続待ち状態になる
http.listen(PORT, function() {
	console.log('接続開始：', PORT);
});
