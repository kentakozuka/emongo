
/*************************************
 * ボットのためのキーワード辞書を作成
 *************************************/

// モジュール
var mongo_client = require('mongodb').MongoClient;
var fs = require('fs');


// MongoDBの接続情報
// 接続オブジェクト
var mongo_db;

// MongoDBに接続
mongo_client.connect(process.env.MONGODB_URI, function (err, db) {
	// エラーチェック
	if (err) {
		console.log("DB error", err); return;
	}

	// MongoDBの接続オブジェクトをグローバル変数に代入
	mongo_db = db;

	// コレクションを取得
	var collection = db.collection('keywords');

	// 既存のデータがあれば一度削除してからinsert
	collection.drop(function(err, reply) {
		insertKeywords(collection);
	});
});

// 会話辞書テキストファイルの指定
var FILE_DIC = './bot-dic.dat';

/**
 * MongoDBに辞書データを挿入
 **/
function insertKeywords(collection) {
	var cnt = 0, dataCount = 0;
	// テキストデータを読み込む
	var txt = fs.readFileSync(FILE_DIC, "utf-8");
	//1行ずつ分割
	var lines = txt.split("\n");
	// 各行を処理
	for (var i in lines) {
		var line = trim(lines[i]);

		// 空行ならスキップ
		if (line == "") continue;
		// コメントならスキップ
		if (line.substr(0,1) == ";") continue; 

		//カンマで分割
		var cells = line.split(",");
		//1セル目：キーワード
		var key = trim(cells[0]);
		//2セル目：検索順位
		var rank = parseInt(trim(cells[1]));
		//3セル目：絞り込み用のパターン
		var pat = trim(cells[2]);
		//4セル目：応答メッセージ
		var msg = trim(cells[3]);
		// insert
		collection.insert(
			{
					"key"		:key
				,	"rank"		:rank
				,	"pattern"	:pat
				,	"msg"		:msg
			},
			function(err, result) {
				//debug
				console.log(cnt+":inserted:", result.ops);
				//
				if (++cnt == dataCount) {
					console.log("done");
					mongo_db.close();
				}
			}
		);
		dataCount++;
	}
}

/**
 * 前後の空白トリムを行う
 **/
function trim(s) {
	s = "" + s;
	return s.replace(/(^\s+|\s+$)/g, "");
}

