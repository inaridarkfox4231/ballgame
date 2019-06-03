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

let data;
const STATIC = 1;
const MOVE = 2;
const FREEZE = 4;

const LIVE = 1;
const DEAD = 2;

function preload(){
	data = loadJSON("https://inaridarkfox4231.github.io/gameData/stage.json");
}

function setup() {
	createCanvas(600, 480);
	myCursor = new cursor();
	myBall = new ball();
	createStage(1);
	//noLoop();
}

function draw() {
	background(100);
	push();
	fill(220);
	rect(0, 0, width, height);
	pop();
	uArray.forEach((u) => {
		u.render();
	});
	myCursor.render();
	blocks.forEach((b) => {
		b.render();
	});
	myBall.update();
	myBall.render();
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
		let ax = this.x * 60;
		let ay = this.y * 60;
		noStroke();
		if(this.state & STATIC){ fill(238, 185, 0); }else if(this.state & MOVE){ fill(0, 0, 255); }else if(this.state & FREEZE){ fill(255, 0, 0); }
		translate(ax, ay);
		rect(0, 0, 60, 60);
		if(this.state & STATIC){ fill(255, 230, 140); }else if(this.state & MOVE){ fill(180, 180, 255); }else if(this.state & FREEZE){ fill(255, 180, 180); }
		unit.drawPath(this.patternId[0]);
		unit.drawPath(this.patternId[1]);
		pop();
	}
	static drawPath(id){
		switch(id){
			case 0:
				rect(0, 20, 40, 20);
				break;
			case 1:
				rect(20, 20, 20, 40);
				break;
			case 2:
				rect(20, 20, 40, 20);
				break;
			case 3:
				rect(20, 0, 20, 40);
				break;
		}
	}
}

class cursor{
	constructor(){
		this.x = 0;
		this.y = 0;
		this.target = undefined;
	}
	set_cursor(x, y){
		this.x = x;
		this.y = y;
	}
	update(dx, dy){
		// はみだすのNG.
		if(this.x + dx < 0 || this.x + dx > 9 || this.y + dy < 0 || this.y + dy > 7){ return; }
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
		strokeWeight(3.0);
		stroke(110);
		noFill();
		rect(this.x * 60, this.y * 60, 60, 60);
		pop();
	}
}

class ball{
	constructor(){
		this.currentUnit = undefined;
		this.count = 0;
		this.in = -1;  // ユニットの入口
		this.out = -1; // ユニットの出口
		this.state = LIVE;
	}
	set_unit(u, inId){
		this.currentUnit = u;
		this.in = inId;
		this.out = u.patternId[0] + u.patternId[1] - inId;
		if(u.state & MOVE){ myCursor.remove_target(); }
		this.count = 0;
		u.inball = true;
	}
	update(){
		// countを進める、60に達したら乗り換え、失敗したらDEAD.
		if(this.state & DEAD){ return; }
		this.count += 0.5;
		if(this.count > 60){
			this.convert();
		}
	}
	render(){
		// countとinId, outIdに応じてボールを描画
		if(this.state & DEAD){ return; }
		push();
		translate(this.currentUnit.x * 60 + 30, this.currentUnit.y * 60 + 30);
	  noStroke();
		fill(100);
		let v = this.calc_pos();
		ellipse(v[0], v[1], 16, 16);
		pop();
	}
	calc_pos(){
		let use_id = (this.count < 30 ? this.in : this.out);
		let t = (use_id % 3 === 0 ? this.count - 30 : 30 - this.count);
		t *= (this.count < 30 ? 1 : -1);
		if(use_id % 2 === 0){
			return [t, 0]
		}else{
			return [0, t];
		}
	}
	convert(){
		// 乗り換え処理. 成功したらtrueを返す
		this.currentUnit.inball = false;
		let direction = calc_dir(this.out);
		let x = this.currentUnit.x + direction[0], y = this.currentUnit.y + direction[1];
		let nextUnitId = find_unit(x, y);
		if(nextUnitId < 0){ this.kill(); return; }
		let nextIn = (this.out + 2) % 4; // 次のinに設定される入口のid. これをnextUnitが持っていなければDEAD.
		// 具体的には0, 2なら2, 0で1, 3なら3, 1.
		let u = uArray[nextUnitId];
		if(u.patternId[0] !== nextIn && u.patternId[1] !== nextIn){ this.kill(); return; }
		// 持っている場合はそこが新しいinになる・・
		this.set_unit(u, nextIn);
	}
	kill(){
		this.currentUnit = undefined;
		this.count = 0;
		this.state = DEAD;
	}
}

class block{
	constructor(x, y){
		this.x = x;
		this.y = y;
	}
	render(){
		let ax = this.x * 60;
		let ay = this.y * 60;
		push();
		fill(185, 122, 107);
		noStroke();
		rect(ax, ay, 60, 60);
		pop();
	}
}

function keyPressed() {
	if(keyCode === 32){
		// スペースキーでユニット捕獲、解除
		let id = find_unit(myCursor.x, myCursor.y);
		if(id < 0){ return; }
		let u = uArray[id];
		if(myCursor.target === undefined){
			if((u.state & FREEZE) || u.inball){ return; } // ボールが入っているか、FREEZEのユニットは捕獲できない
			myCursor.set_target(u);
			return;
		}else{
			myCursor.remove_target();
			return;
		}
	}
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
		uArray.push(new unit(p % 10, Math.floor(p / 10), t & 3, (t >> 2) & 3, i, stateArray[i]));
	}
}

function createBlockArray(posArray){
	blocks = [];
	for(let i = 0; i < posArray.length; i++){
		let p = posArray[i];
		blocks.push(new block(p % 10, Math.floor(p / 10)));
	}
}

function createStage(stageNumber){
	let d = data["stage" + stageNumber];
	//let posArray = [32, 33, 42, 43, 64, 65, 54, 55, 10, 11, 12, 17, 67, 68, 69];
	let posArray = d.posArray;
	let typeArray = d.typeArray;
	let stateArray = constArray(d.state, STATIC);
	stateArray.push(...constArray(d.freeze, FREEZE));
	createUnitArray(posArray, typeArray, stateArray);
	createBlockArray(d.blockArray);
	//console.log(data.cursorPos);
	myCursor.set_cursor(d.cursorPos % 10, Math.floor(d.cursorPos / 10));
	myBall.set_unit(uArray[d.ballPos], 0);
}

function constArray(n, s){
	let array = new Array(n);
	for(let i = 0; i < n; i++){ array[i] = s; }
	return array;
}
