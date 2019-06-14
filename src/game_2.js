'use strict';
// 壁との反射
// パドルとの反射
// 落ちたら復活
// などなど
// 当たるとドレミーの音がすると面白い？

let myPaddle;
let myBall;
let myCursor;
let blocks = [];
let hueSet = [0, 15, 30, 45, 60, 75, 90];
let soundSet = [];

const STATIC = 0;
const ACTIVE = 1;

const timeCounter = document.createElement('div');
document.body.appendChild(timeCounter);

function preload(){
	let dict = ["C4", "D4", "E4", "F4", "G4"];
	for(let i = 0; i < 5; i++){
	  let s = loadSound("https://inaridarkfox4231.github.io/assets/u-50_" + dict[i] + ".wav");
	  soundSet.push(s);
	}
}

function setup() {
	createCanvas(480, 320);
	colorMode(HSB, 100);
	angleMode(DEGREES);
	myPaddle = new paddle();
	myBall = new ball();
	myBall.set_paddle(myPaddle);
	myCursor = new cursor();
	myCursor.set_ball(myBall);
	myBall.set_cursor(myCursor);
	for(let i = -4; i <= 4; i++){
		for(let k = 0; k < 5; k++){
			let b = new block(width / 2 + i * 40, height / 4 + k * 20, k, k + 1);
		  blocks.push(b);
		}
	}
}

function draw() {
  const start = performance.now(); // 時間表示。
	background(70, 20, 100);
	myPaddle.update();
	myBall.update();
	myCursor.update();
	myPaddle.render();
	myBall.render();
	myCursor.render();
	blocks.forEach((b) => { b.render(); });
  const end = performance.now();
  const timeStr = (end - start).toPrecision(4);
  timeCounter.innerText = `${timeStr}ms`;
}

class ball{
	constructor(){
		this.x = width / 2;
		this.y = height - 45;
		this._paddle = undefined;
		this.state = STATIC;
		this._cursor = undefined;
		this.speed = 4;
		this.direction = 15;
	}
	set_paddle(_paddle){
		this._paddle = _paddle;
	}
	set_cursor(_cursor){
		this._cursor = _cursor;
	}
	update(){
		if(this.state === STATIC){
			this.x = this._paddle.x;
		}else if(this.state === ACTIVE){
			let newX = this.x + this.speed * cos(this.direction);
			let newY = this.y - this.speed * sin(this.direction);
		  this.update_pos(newX, newY);
			if(this.y > height + 5){ this.reset(); }
		}
	}
	render(){
		push();
		fill(80, 70, 50);
		ellipse(this.x, this.y, 10, 10);
		pop();
	}
	reset(){
		this.state = STATIC;
		this.direction = 15;
		this._cursor.on();
		this._cursor.reset();
		this.x = this._paddle.x;
		this.y = height - 45;
	}
	activate(){
		this.state = ACTIVE;
		this.direction = this._cursor.direction;
		this._cursor.off();
	}
	update_pos(newX, newY){
		let nextX = newX;
		let nextY = newY;
		// 両側の壁との反射
		if(newX < 5 || newX > width - 5){
			if(this.direction < 180){ this.direction = 180 - this.direction; }
			else{ this.direction = 540 - this.direction; }
			if(newX < 5){ nextX = 5; nextY = map(5, this.x, newX, this.y, newY); }
			else{ nextX = width - 5; nextY = map(width - 5, this.x, newX, this.y, newY); }
		}
		// 上の壁との反射
		if(newY < 5){
			this.direction = 360 - this.direction;
			nextY = 5;
			nextX = map(5, this.y, newY, this.x, newX);
		}
		// パドルとの反射
		if(this.y < height - 45 && newY >= height - 45 && abs(this.x - this._paddle.x) < this._paddle.w + 10){
			let p = map(height - 45, this.y, newY, this.x, newX);
			if(abs(p - this._paddle.x) <= this._paddle.w){
				let r = map(p, this._paddle.x - this._paddle.w, this._paddle.x + this._paddle.w, 0, 1);
				this.direction = map(r, 0, 1, 165, 15);
				nextX = p;
				nextY = height - 45;
			}
		}
		// ブロックとの反射
    // ここにあのメソッドを放り込んで・・
		for(let index = 0; index < blocks.length; index++){
			let bx = blocks[index].x;
			let by = blocks[index].y;
			if(abs(newX - bx) > 25 || abs(newY - by) > 15){ continue; }
			let phase = 0;
			if(this.x < bx - 20){ phase += 0; }else if(this.x > bx + 20){ phase += 2; }else{ phase += 1; }
			if(this.y < by - 10){ phase += 0; }else if(this.y > by + 10){ phase += 6; }else{ phase += 3; }
			this.reflection(phase); // 速度の変更
			blocks[index].break_off(1); // ブロックの破壊
			// 新しい速度が決まったらめり込む前に次の方向に進んでしまうことにする
			nextX = this.x + this.speed * cos(this.direction);
			nextY = this.y - this.speed * sin(this.direction);
			break; // ひとつでもぶつかったら抜ける
		}
		this.x = nextX;
		this.y = nextY;
	}
	reflection(phase){
		// 反射方向の計算
		if(phase % 2 === 0){
			this.direction = 30 + random(30);
			if(phase === 0){ this.direction += 90; }
			else if(phase === 6){ this.direction += 180; }
			else if(phase === 8){ this.direction += 270; }
		}else{
			if(phase === 1 || phase === 7){
				this.direction = 360 - this.direction;
			}else if(phase === 3 || phase === 5){
				if(this.direction < 180){ this.direction = 180 - this.direction; }else{ this.direction = 540 - this.direction; }
			}
		}
	}
}

class cursor{
	constructor(){
		this.direction = 15; // 15, 45, 75, 105, 135, 165.
		this.sgn = 1;
		this.count = 0;
		this._ball = undefined;
		this.x = 0;
		this.y = 0;
		this.isOn = true;
	}
	set_ball(_ball){
		this._ball = _ball;
	}
	get_direction(){
		return this.direction;
	}
	on(){
		this.isOn = true;
	}
	off(){
		this.isOn = false;
	}
	update(){
		if(!this.isOn){ return; }
		this.x = this._ball.x;
		this.y = this._ball.y;
		this.count++;
		if(this.count >= 60){
			this.direction += this.sgn * 30;
			this.count = 0;
			if(this.direction === 15 || this.direction === 165){ this.sgn *= -1; }
		}
	}
	render(){
		if(!this.isOn){ return; }
		push();
		strokeWeight(2.0);
		stroke(60, 100, 100);
		//translate(this.x, this.y);
		line(this.x, this.y, this.x + 30 * cos(this.direction), this.y - 30 * sin(this.direction));
		pop();
	}
	reset(){
		this.direction = 15;
		this.sgn = 1;
		this.count = 0;
	}
}

class paddle{
	constructor(){
		this.x = width / 2;
		this.w = 60;
	}
	update(){
		this.x = constrain(mouseX, this.w / 2, width - (this.w / 2));
	}
	render(){
		push();
		fill(70, 100, 100);
		rect(this.x - (this.w / 2), height - 40, this.w, 10);
		pop();
	}
}

class block{
	constructor(x, y, typeId, tough){
		this.x = x;
		this.y = y;
		this.typeId = typeId;
		this.id = block.id;
		block.id++;
		this.tough = tough;
	}
	update(){}
	render(){
		push();
		noStroke();
		fill(hueSet[this.typeId], 40, 100);
		rect(this.x - 20, this.y - 10, 40, 20);
		fill(hueSet[this.typeId], 70, 100);
		rect(this.x - 20, this.y - 10, 38, 18);
		fill(hueSet[this.typeId], 100, 100);
		rect(this.x - 18, this.y - 8, 36, 16);
		pop();
	}
	break_off(dmg){
		soundSet[this.typeId].play();
		if(this.typeId <= 4){ this.tough -= dmg; this.typeId -= dmg; }
		if( this.tough > 0 ){ return; }
		for(let index = 0; index < blocks.length; index++){
			if(blocks[index].id === this.id){
				blocks.splice(index, 1);
				break;
			}
		}
	}
}

block.id = 0;

function mouseClicked(){
	if(myBall.state === STATIC){ myBall.activate(); return; }
}
