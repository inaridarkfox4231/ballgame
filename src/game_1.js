// なんか作りたい、らしい・・？
// なんかいい感じ。

// STATIC: 動いていない状態（灰色）
// MOVE: 動かされている状態（青）
// FREEZE: 動かせない状態（赤）
// inballはbool処理。

'use strict';
let myCursor;
let uArray = [];
let blocks = [];
let myBall;
let stageNumber;
let gridSize;
let row; // rowがないとだめだろ。カーソルはみだしちゃう。
let col; // col.
// row(行数、横の列の本数)とcol(列数、縦の列の本数)もグローバルにして（本来はクラスとかにしてまとめるべき・・）、
// ステージごとにサイズを決められるようにしたら面白そう。
// あとスタート位置とかフェイズとかゴール条件とかいじって上とか下から出たり入ったりできるようにしたいわね。
// STATIC MOVE FREEZE GOALでゴールは緑にするとか。ゴールは基本的にフリーズ扱いで（スタートについては単にフリーズ）、
// あ、スタートをSTATICにしても別にいいのか。スタートがフリーズである必要は全くないものね。
// ゴールはあちこち移動しちゃまずいからFREEZE扱いのGOALにする、と。
// FREEZEのすべてのプロパティを受け継ぎつつかつそれをくぐるとクリアするみたいなやつー
// スタート位置で遊ぶ場合は0のデフォルトもいじる（スタートフェイズ）。
// row, col, startPhase, goalPos.
const LAST_STAGE_NUMBER = 9;
//const GRID_SIZE = 60;

let intervalCount;

let data;
const STATIC = 1;
const MOVE = 2;
const FREEZE = 4;
const GOAL = 8;  // GOALは基本FREEZEで、クリア判定に使う。色は緑。goalPosは必要ない。末尾をゴール用にする。

const WAIT = 1;
const LIVE = 2;
const DEAD = 4;
const CLEAR = 8;

function preload(){
	data = loadJSON("https://inaridarkfox4231.github.io/gameData/stage.json");
}

function setup() {
	createCanvas(600, 480);
	// これを720x480にして、9面以降はgridSize = 48にしたい。で、12x8のサイズから15x10のサイズにスケールアップとかそういう？
	// 必要ない。ステージごとに横幅と縦幅を設定すればいいだけ。48の他に、3の倍数なら何でも。36とかでもいける。
	myCursor = new cursor();
	myBall = new ball();
	stageNumber = 1;
	gridSize = 0;
	col = 0;
	row = 0;
	createStage(stageNumber);
	intervalCount = 60;
	//noLoop();
}

function draw() {
	background(100);
	push();
	fill(220);
	rect(0, 0, col * gridSize, row * gridSize);
	pop();
	uArray.forEach((u) => {
		u.render();
	});
	blocks.forEach((b) => {
		b.render();
	});
	myCursor.render();
	if(myBall.state & WAIT){
	  /* 画面を透明で覆ってステージ数表示 */
		push();
		fill(0, 0, 0, 120);
		rect(0, 0, width, height);
		textSize(40);
		fill(255);
		text("STAGE" + stageNumber, 100, 100);
		pop();
		intervalCount--;
		if(intervalCount === 0){ myBall.state = LIVE; }
	}
	else if(myBall.state & LIVE){
	  /* myBallのupdateとrender. */
	  myBall.update();
 	  myBall.render();
 }
	else if(myBall.state & DEAD){
	  /* FAILED...の表示のあとで同じステージのやり直し */
		push();
		fill(0, 0, 0, 120);
		rect(0, 0, width, height);
		textSize(40);
		fill(255);
		text("FAILED...", 100, 100);
		pop();
		intervalCount--;
		if(intervalCount === 0){
			myBall.state = WAIT;
			intervalCount = 60;
			createStage(stageNumber);
		}
	}
	else if(myBall.state & CLEAR){
	  /* CLEAR!の表示のあと新しいステージになってWAITに戻る */
		push();
		fill(0, 0, 0, 120);
		rect(0, 0, width, height);
		textSize(40);
		fill(255);
		text("CLEAR!", 100, 100);
		pop();
		intervalCount--;
		if(intervalCount === 0){
			myBall.state = WAIT;
			intervalCount = 60;
			stageNumber = (stageNumber % LAST_STAGE_NUMBER) + 1;
			createStage(stageNumber);
		}
	}
}

// unitのupdateかなんかで上下左右にユニットがないかとか、
// その入り口がどっちに開いているかとかそういうの記録して、
// ボールが伝わるようにするいろいろしないとね。
// 1フレームで1動くとして踏破するのに30フレーム＋30フレーム
// 30との大小比較で位置が分かる
// 入ってきたのがどっちで出ていくのがどっちかで位置が決まる、入った瞬間に入口と出口が決まる。
// たとえば2と3をもっておいて、入り口が2か3のとき2か3が入口と出口（もう一方が出口）とかそういう。
// この2とか3の情報を元にrenderするとか。
// 2と3とprogress(0～60)があれば位置が割り出せる。で、outしたときに接続を探す。接続はfind_unitで探して、
// 対象は捕獲されている場合自動的に解除される、されていなければそのままボールが伝わる感じ。
// 対象がないか、いてもそっち側に開いて無ければBANG!!する。

// 出口に着いたらまず次のマスを調べるのが先決。currentUnitのx, yにout番号に応じたベクトルを加えればマス数が出るのでそれを見て
// find_unitを適用すると出せる。そこが何もなかったらDEAD.何かあったとして、・・あ、FREEZEかつINBALLの状態があるのか。
// 2進数にしておいてよかった。このふたつは重なり合うので、注意しないとね・・じゃあ |= にしないとだね。FREEZEが解除されちゃう。
// 元のユニットでINBALLを解除する。
// ・・ボールは別のクラスにしようね。

// 最初にSTAGE1みたいに表示される・・透明なカバー、白い文字。
// 文字の表示のあと自動的にスタート。
// クリアした場合は次のステージが始まる。クリアーの文字のあとで。
// 失敗の場合は同じステージから再スタート。
// 5つくらい、全部クリアで元に戻る。初めから。多分そんな感じ？？
class unit{
	constructor(x, y, id0, id1, selfId, state){
		this.x = x;
		this.y = y;
		this.patternId = [id0, id1];
		this.state = state;
		this.inball = false;
		this.id = selfId;
	}
	set_state(state){
		this.state = state;
	}
	render(){
		push();
		let ax = this.x * gridSize;
		let ay = this.y * gridSize;
		noStroke();
		if(this.state & STATIC){ fill(238, 185, 0); }else if(this.state & MOVE){ fill(0, 0, 255); }else if(this.state & FREEZE){ fill(255, 0, 0); }else if(this.state & GOAL){ fill(34, 177, 76); }
		translate(ax, ay);
		rect(0, 0, gridSize, gridSize);
		if(this.state & STATIC){ fill(255, 230, 140); }else if(this.state & MOVE){ fill(180, 180, 255); }else if(this.state & FREEZE){ fill(255, 180, 180); }else if(this.state & GOAL){ fill(137, 233, 166); }
		unit.drawPath(this.patternId[0]);
		unit.drawPath(this.patternId[1]);
		pop();
	}
	static drawPath(id){
		let gs = gridSize / 3;
		switch(id){
			case 0:
				rect(0, gs, gs * 2, gs);
				break;
			case 1:
				rect(gs, gs, gs, gs * 2);
				break;
			case 2:
				rect(gs, gs, gs * 2, gs);
				break;
			case 3:
				rect(gs, 0, gs, gs * 2);
				break;
		}
	}
}

class cursor{
	constructor(){
		this.x = 0;
		this.y = 0;
		this.target = undefined;
		this.stroke_weight = 0.0;
	}
	set_cursor(x, y){
		this.x = x;
		this.y = y;
		this.target = undefined; // ターゲットリセット。
	}
	set_stroke_weight(new_weight){
		this.stroke_weight = new_weight;
	}
	update(dx, dy){
		// はみだすのNG.
		if(this.x + dx < 0 || this.x + dx > col - 1 || this.y + dy < 0 || this.y + dy > row - 1){ return; }
		// 重なるのNG.
		if(this.target !== undefined && find_unit(this.x + dx, this.y + dy) >= 0){ return; }
		// ブロックNG.
		if(find_block(this.x + dx, this.y + dy) >= 0){ return; }
		this.x += dx;
		this.y += dy;
		if(this.target !== undefined){
		  this.target.x += dx;
			this.target.y += dy;
		}
	}
	set_target(u){
		this.target = u;
		u.set_state(MOVE);
	}
	remove_target(){
		this.target.set_state(STATIC);
		this.target = undefined;
	}
	render(){
		push();
		strokeWeight(this.stroke_weight);
		stroke(110);
		noFill();
		rect(this.x * gridSize, this.y * gridSize, gridSize, gridSize);
		pop();
	}
}

class ball{
	constructor(){
		this.currentUnit = undefined;
		this.count = 0;
		this.in = -1;  // ユニットの入口
		this.out = -1; // ユニットの出口
		this.state = WAIT;
		this.speed = 0;
	}
	set_unit(u, inId){
		this.currentUnit = u;
		this.in = inId;
		this.out = u.patternId[0] + u.patternId[1] - inId;
		if(u.state & MOVE){ myCursor.remove_target(); }
		this.count = 0;
		u.inball = true;
	}
	set_speed(new_speed){
		this.speed = new_speed;
	}
	update(){
		// countを進める、60に達したら乗り換え、失敗したらDEAD. LIVEのときしかupdateしない。
		if(!(this.state & LIVE)){ return; }
		if(keyIsDown(65)){ this.count += this.speed * 3; }else{ this.count += this.speed; } // Aキーで3倍速
		if(this.count > gridSize){
			this.convert();
		}
	}
	render(){
		// countとinId, outIdに応じてボールを描画. LIVEのときしか描画しない。
		if(!(this.state & LIVE)){ return; }
		push();
		translate(this.currentUnit.x * gridSize + gridSize / 2, this.currentUnit.y * gridSize + gridSize / 2);
	  noStroke();
		fill(100);
		let v = this.calc_pos();
		let diam = (gridSize / 3) * 0.8;
		ellipse(v[0], v[1], diam, diam);
		pop();
	}
	calc_pos(){
		let border = gridSize / 2;
		let use_id = (this.count < border ? this.in : this.out);
		let t = (use_id % 3 === 0 ? this.count - border : border - this.count);
		t *= (this.count < border ? 1 : -1);
		if(use_id % 2 === 0){
			return [t, 0]
		}else{
			return [0, t];
		}
	}
	convert(){
		// 乗り換え処理.
		// クリアはGOALユニット通過時とする。
		if(this.currentUnit.state & GOAL){ this.clear(); return; } // このように変更。
		// 以下はクリアでない場合の処理。
		this.currentUnit.inball = false;
		let direction = calc_dir(this.out);
		let x = this.currentUnit.x + direction[0], y = this.currentUnit.y + direction[1];
		let nextUnitId = find_unit(x, y);
		// 右端に達する以外で何もない場合にFAILEDってことで。
		if(nextUnitId < 0){ this.kill(); return; }
		let nextIn = (this.out + 2) % 4; // 次のinに設定される入口のid. これをnextUnitが持っていなければDEAD.
		// 具体的には0, 2なら2, 0で1, 3なら3, 1.
		let u = uArray[nextUnitId];
		// ユニットがあっても入れない場合はFAILEDってことで。
		if(u.patternId[0] !== nextIn && u.patternId[1] !== nextIn){ this.kill(); return; }
		// 入れる場合の処理。
		this.set_unit(u, nextIn);
	}
	kill(){
		this.currentUnit = undefined;
		this.count = 0;
		this.state = DEAD;
		intervalCount = 60; // FAILEDの表示時間
	}
	clear(){
		this.currentUnit = undefined;
		this.count = 0;
		this.state = CLEAR;
		intervalCount = 60;
	}
}

class block{
	constructor(x, y){
		this.x = x;
		this.y = y;
	}
	render(){
		let ax = this.x * gridSize;
		let ay = this.y * gridSize;
		push();
		fill(185, 122, 107);
		noStroke();
		rect(ax, ay, gridSize, gridSize);
		pop();
	}
}

function keyPressed() {
	if(keyCode === 32){
		// スペースキーでユニット捕獲、解除
    catch_unit(); return;
	}
  if(!(myBall.state & LIVE)){ return; } // LIVEのときしかカーソルを動かせない
	// 十字キーでカーソルの移動
	let diffX = 0, diffY = 0;
  if (keyCode === RIGHT_ARROW) {
    diffX = 1;
  }else if (keyCode === DOWN_ARROW) {
    diffY = 1;
  }else  if(keyCode === LEFT_ARROW) {
    diffX = -1;
  }else if(keyCode === UP_ARROW) {
    diffY = -1;
  }
	myCursor.update(diffX, diffY);
}

function find_unit(x, y){
	for(let i = 0; i < uArray.length; i++){
		if(uArray[i].x === x && uArray[i].y === y){ return i; }
	}
	return -1;
}

function find_block(x, y){
	for(let i = 0; i < blocks.length; i++){
		if(blocks[i].x === x && blocks[i].y === y){ return i; }
	}
	return -1;
}

function catch_unit(){
	let id = find_unit(myCursor.x, myCursor.y);
	if(id < 0){ return; }
	let u = uArray[id];
	if(myCursor.target === undefined){
		if((u.state & (FREEZE | GOAL)) || u.inball){ return; } // ボールが入っているか、FREEZE,GOALのユニットは捕獲できない
		myCursor.set_target(u);
		return;
	}else{
		myCursor.remove_target();
		return;
	}
}

function calc_dir(id){
	switch(id){
		case 0:
			return [-1, 0];
		case 1:
			return [0, 1];
		case 2:
			return [1, 0];
		case 3:
			return [0, -1];
	}
}

function createUnitArray(posArray, typeArray, stateArray){
	uArray = [];
	for(let i = 0; i < posArray.length; i++){
		let p = posArray[i];
		let t = typeArray[i];
		//let col = Math.floor(width / gridSize);
		uArray.push(new unit(p % col, Math.floor(p / col), t & 3, (t >> 2) & 3, i, stateArray[i]));
	}
}

function createBlockArray(posArray){
	blocks = [];
	for(let i = 0; i < posArray.length; i++){
		let p = posArray[i];
		//let col = Math.floor(width / gridSize);
		blocks.push(new block(p % col, Math.floor(p / col)));
	}
}

function createStage(stageNumber){
	//if(stageNumber === 1){ createStage_test(); return; }
	let d = data["stage" + stageNumber];
	gridSize = d.gridSize;
	col = d.col;
	row = d.row;
	let stateArray = constArray(d.static, STATIC);
	stateArray.push(...constArray(d.freeze, FREEZE));
	stateArray.push(GOAL); // 末尾をゴール用にすればgoalPosの必要はないよね。
	createUnitArray(d.posArray, d.typeArray, stateArray);
	createBlockArray(d.blockArray);
	myCursor.set_cursor(d.cursorPos % col, Math.floor(d.cursorPos / col));
	// ここfind_unitで出せるようにしたい。いちいち番号変えるの面倒。
	let index = find_unit(d.ballPos % col, Math.floor(d.ballPos / col));
	myBall.set_unit(uArray[index], 0);
	myBall.set_speed(gridSize / 120); // 2秒で通過
	myCursor.set_stroke_weight(gridSize / 20);
}

// テスト用のクリエイト関数
/*
function createStage_test(){
	gridSize = 60;
	col = 10;
	row = 8;
	let posArray = [11, 12, 13, 14, 15, 16, 18, 21, 25, 31, 41, 48, 55, 57, 58, 30, 73];
	let typeArray = [9, 8, 8, 8, 9, 8, 4, 13, 13, 12, 13, 13, 14, 8, 12, 8, 13];
	let stateArray = constArray(15, STATIC);
	stateArray.push(...constArray(1, FREEZE));
	stateArray.push(GOAL);
	createUnitArray(posArray, typeArray, stateArray);
	createBlockArray([0, 3, 8, 19, 23, 26, 29, 33, 43, 53, 54, 65, 69, 70, 77, 78, 47]);
	myCursor.set_cursor(31 % col, Math.floor(31 / col));
	let index = find_unit(30 % col, Math.floor(30 / col));
	myBall.set_unit(uArray[index], 0); // ここをいじって壁面側（たとえば上側なら上とか）からボールが出てくるようにする。
	// 角の場合は、双方に接していることはないから問題ない・・（双方に接したらすぐ終わっちゃうでしょ）
	myBall.set_speed(gridSize / 120); // 2秒で通過
	myCursor.set_stroke_weight(gridSize / 20);
}*/

function constArray(n, s){
	let array = new Array(n);
	for(let i = 0; i < n; i++){ array[i] = s; }
	return array;
}
