/******************************
 * 会話ボットの応答を生成するモジュール
 *****************************/


// モジュールの取り込み
var Mecab = require('mecab-lite'),
mecab = new Mecab(),
mongo_client = require('mongodb').MongoClient;

// MongoDBの接続情報を保持する変数
// (nullで初期化してからkeywords_coを代入)
var mongo_db = null, keywords_co;

// 外部に getResponse() メソッドを公開
module.exports = {
	"getResponse": getResponse
};

/*
 * 会話ボットの応答を返す関数
 */
function getResponse(msg, callback) {
	//DB接続
	checkDB()
	.then(function() {
		//ボット呼び出し
		var bot = new Bot(msg, callback);
		bot.talk();
	});
}

// MongoDBへ接続
function checkDB() {
	return new Promise(function(resolve, reject) {
		// 既に接続していれば何もしない
		if (mongo_db) {
			return resolve();
		}
		// MongoDBに接続
		// herokuの環境変数を使用
		mongo_client.connect(process.env.MONGODB_URI, function (err, db) {
			// エラーチェック
			if (err) {
				console.log("DB error", err);
				return reject();
			}
			// 接続情報を記録
			mongo_db = db;
			// コレクションを取得
			keywords_co = db.collection('keywords');
	
			resolve();
		});
	});
}

/********************
 * ボットクラスの定義
 *******************/
function Bot(msg, callback) {
	this.callback	= callback;
	this.msg		= msg;
	this.results	= [];
	this.words		= [];
	this.index		= 0;
}

// ボットからの応答を得るメソッド
Bot.prototype.talk = function() {
	/*
	 * JSのthisは４種類ある
	 * 1. トップレベルのthis
	 *    グローバルオブジェクトを指す。
	 * 2. コンストラクタ内のthis
	 *    作られるインスタンス自身を指す。
	 * 3. 何かに所属している時のthis
	 *    所属しているオブジェクトを指す。
	 * 4. apply() とか call() とかで無理矢理変えられた時のthis
	 */
	//このthisはBotクラス自身(3)
	var botClass = this;
	// 形態素解析
	// 文を単語ごとに分割する
	mecab.parse(this.msg, function (err, words) {
		console.log(words);
		//ここのthisはmecab(2)
		//エラーの場合
		if (err) {
			self.callback("Error");
			return;
		}
		// 一文の中の分割した単語を一つずつ確認する
		botClass.index = 0;
		botClass.words = words;
		botClass.nextWord();
	});
};

// 一文の中の各単語を一語ずつ調べるメソッド
Bot.prototype.nextWord = function() {

	var self = this;

	// 単語を最後まで調べたか確認
	if (this.index >= this.words.length) {
		this.response();
		return;
	}
	/*
	 * データベースを検索
	 * meCabの出力要素一覧は下記の通り
	 * 表層形\t品詞,品詞細分類1,品詞細分類2,品詞細分類3,活用型,活用形,原形,読み,発音
	 */
	//単語を取り出す
	var w = this.words[this.index];
	// 活用のない単語（原型）を取り出す
	var org = (w.length >= 7) ? w[7] : w[0];
	//コレクションから検索
	keywords_co
	.find({key:org})
	.toArray(function(err, rows) {
		// データベースに合致する語がない場合
		if (rows.length == 0) {
			self.nextWord();
			return;
		}
		// パターンにマッチするか確認
		var keys = rows.filter(function(el, index, ary) {
			if (el.pattern == "*") {
				return true;
			}
			if (self.msg.indexOf(el.pattern) >= 0) {
				 return true;
			}
			return false;
		});
		if (keys.length > 0) {
			var r = Math.floor(Math.random() * keys.length);
			var key = keys[r];
			self.results.push(key.msg);
		}
		self.response();
	});
	//インデックスをインクリメント
	this.index++;
};

// 結果を戻す
Bot.prototype.response = function() {
	var res = "もう少しかみ砕いて話してください。";
	//結果があればそれを返す
	//なければresを返す
	if (this.results.length > 0) {
		res = this.results.join("。");
	}
	this.callback(res);
};



