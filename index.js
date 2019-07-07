//Credit to Daniel Shiffman at https://github.com/CodingTrain/website/tree/master/Node/sockets for some of this code
const express = require('express');
const app = express();
const server = app.listen(process.env.PORT || 3000);
const io = require('socket.io')(server)
app.use(express.static('public'));
console.log("Server started");

const fps = 17 - 1; //1000 / 60; //Runs at ~60fps, the -1 is to fix innacuracies in JS timing
const timingAccuracy = .6; //Lower is more accurate, but it takes more iterations
let lastFrameTime = Date.now();
let deltaTime = 0;

const WIDTH = 640;
const HEIGHT = 360;


let rooms = [];
let clientsQueue = [];

class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    heading() {
        return Math.atan2(this.y, this.x);
    }

    set(a, b) {
        this.x = a;
        this.y = b;
    }

    copy() {
        return (new Vector(this.x, this.y));
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
    }

    sub(v, z) {
        if (v instanceof Vector) {
            this.x += v.x;
            this.y += v.y;
        } else {
            this.x -= v.x;
            this.y -= z.y;
        }
    }

    magSq() {
        return (this.x * this.x) + (this.y * this.y);
    }

    mag() {
        return Math.sqrt((this.x * this.x) + (this.y * this.y));
    }

    mult(m) {
        this.x *= m;
        this.y *= m;
    }

    setMag(m) {
        const currMagSq = (this.x * this.x) + (this.y * this.y);
        if (m * m != currMagSq) {
            const currMag = Math.sqrt(currMagSq);
            this.x = (this.x / currMag) * m;
            this.y = (this.y / currMag) * m;
        }
    }
}

class Text {
    constructor(text, x, y, size) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.size = size;
    }

    serialize() {
        return {
            "text": this.text,
            "x": this.x,
            "y": this.y,
            "size": this.size,
        }
    }
}

class Ball {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.pos;
        this.vel;
        this.prevPos;
        this.prevVel;
        this.maxAng = Math.PI * .4;
        this.baseSpeed = .2;
        this.speed = this.baseSpeed;
        this.reset();
    }

    fixMag() {
        this.vel.setMag(this.speed);
    }

    reset() {
        this.speed = this.baseSpeed;
        this.pos = new Vector((WIDTH / 2) - (this.width / 2), (HEIGHT / 2) - (this.height / 2));
        let ang = (Math.random() * (this.maxAng * 2)) - (this.maxAng);
        if (Math.random() < .5) ang += Math.PI;

        this.vel = new Vector(Math.cos(ang) * this.speed, Math.sin(ang) * this.speed);
        this.prevPos = this.pos.copy();
        this.prevVel = new Vector();
    }

    update(p1, p2) {
        let bouncedOff = -1;

        this.prevPos = this.pos.copy();
        this.prevVel = this.vel.copy();
        this.vel.setMag(deltaTime * this.speed);

        this.pos.add(this.vel);

        this.bounceWalls();
        this.pos.y = Math.max(Math.min(HEIGHT - this.height, this.pos.y), 0); //Constrain vertical position (can't go into floor)
        if (p1.powerup != "dead" && this.hitPaddle(p1, -1)) bouncedOff = 0;
        if (p2.powerup != "dead" && this.hitPaddle(p2, 1)) bouncedOff = 1

        if (this.vel.magSq() > 225) { //Make sure the ball never goes too fast (can't go above 15 speed)
            this.vel.setMag(15);
        }
        if (this.vel.x < .3 && this.vel.x > -.3) { //Make sure the ball never goes too vertical
            if (this.vel.x == 0) {
                console.log("THE BALLS VEL.X IS ZERO!!!!!");
                if (this.pos.x > WIDTH / 2) this.vel.x += .1;
                else this.vel.x -= .1
            } else if (this.vel.x >= 0) {
                this.vel.x += .05;
            } else {
                this.vel.x -= .05;
            }
            this.fixMag();
        }
        return bouncedOff;
    }

    bounceWalls() { //Bounce off floor and ceiling
        if ((this.pos.y <= 0 && this.vel.y < 0) || (this.pos.y >= HEIGHT - this.height && this.vel.y > 0)) {
            this.vel.y *= -1;
        }
    }

    checkScore() {
        if (this.pos.x >= WIDTH || this.pos.x <= -this.width) {
            return [true, this.pos.x];
        } else {
            return [false];
        }
    }

    hitPaddle(p, desDir) {
        let hasBounced = false;
        if (this.hitRect(this.pos, p)) {
            const xChanged = new Vector(this.prevPos.x + this.prevVel.x, this.prevPos.y); //Testing to see if it is bouncing of the side
            const yChanged = new Vector(this.prevPos.x, this.prevPos.y + this.prevVel.y); //Or the top/bottom

            if (desDir == this.vel.x / Math.abs(this.vel.x) && this.hitRect(xChanged, p)) { //To hit off the side, must be moving in the right direction
                if ((desDir == -1 && this.pos.x > p.pos.x + (p.width * .25)) || //It will only bounce off the front quarter of the paddle
                    desDir == 1 && this.pos.x + this.width < p.pos.x + (p.width * .75)) {
                    const horzDist = (this.pos.y + this.height / 2) - (p.pos.y + p.height / 2); //Calculations for the angle it should reflect off based on where it hits the paddle
                    const maxDist = (p.height / 2) + (this.height / 2);
                    const ang = (horzDist / maxDist) * this.maxAng;
                    this.vel.set(Math.cos(ang) * this.speed * -desDir, Math.sin(ang) * this.speed); //Reflect at that angle
                    hasBounced = true;
                }
            }
            if (this.hitRect(yChanged, p)) { //If it is bouncing off the top/bottom
                if (this.pos.y + this.height / 2 > p.pos.y + p.height / 2) { //If its hitting the bottom
                    this.vel.y = Math.abs(this.vel.y); //Make it bounce down
                    hasBounced = true;
                    if (p.down) { //If paddle is moving up, bounce it up more
                        const nextPos = new Vector(this.pos.x + this.vel.x, this.pos.y + this.vel.y);
                        if (this.hitRect(nextPos, nextPos, p.width, p.height)) {
                            this.pos.y += (p.speed * deltaTime); //Push the ball down

                            this.vel.set(this.vel.x, this.vel.y * 1.3);
                            this.speed *= 1.1;
                        }
                    }
                } else { //If its hitting the top
                    this.vel.y = -Math.abs(this.vel.y); //make it bounce up
                    hasBounced = true;
                    if (p.up) {
                        const nextPos = new Vector(this.pos.x - this.vel.x, this.pos.y + this.vel.y);
                        if (this.hitRect(nextPos, nextPos, p.width, p.height)) {
                            this.pos.y -= (p.speed * deltaTime); //Push the ball up

                            this.vel.set(this.vel.x, this.vel.y * 1.3);
                            this.speed *= 1.1;

                            console.log("speed up");
                        }
                    }
                }
            }
        }
        return hasBounced;
    }

    hitPowerup(p) {
        return this.hitRect(this.pos, p.pos, p.width, p.height);
    }

    hitRect(pos, p, w, h) {
        if (p instanceof Player) {
            return (pos.x + this.width >= p.pos.x && pos.x <= p.pos.x + p.width && //Is inbtwn left and right of paddle
                pos.y + this.height >= p.pos.y && pos.y <= p.pos.y + p.height) //Is inbtwn top and bottom of paddle
        } else {
            return (pos.x + this.width >= p.x && pos.x <= p.x + w && //Is inbtwn left and right of paddle
                pos.y + this.height >= p.y && pos.y <= p.y + h) //Is inbtwn top and bottom of paddle
        }
    }

    serialize() {
        return {
            'name': 'ball',
            'x': this.pos.x,
            'y': this.pos.y,
            'vx': this.vel.x,
            'vy': this.vel.y,
            'width': this.width,
            'height': this.height,
            'speed': this.speed
        };
    }
}

class Fireball {
    constructor(pos, dir) {
        this.width = 40;
        this.height = 40;
        this.rot = 0;
        this.lastRot = 0;
        this.pos = new Vector(pos.x, pos.y - (this.height / 2));
        if (dir == -1) this.pos.x -= this.width;
        this.speed = .25;
        this.vel = new Vector(dir * this.speed * .5, this.speed * 0.866); //The ball at a -60° ang
    }

    fixMag() {
        this.vel.setMag(this.speed);
    }

    update(p1, p2) {
        let hitPlayer = -1;

        this.vel.setMag(deltaTime * this.speed);
        this.pos.add(this.vel);

        this.bounceWalls();
        this.pos.y = Math.max(Math.min(HEIGHT - this.height, this.pos.y), 0); //Constrain vertical position (can't go into floor)
        if (p1.powerup != "dead" && this.hitPaddle(p1)) hitPlayer = 0;
        if (p2.powerup != "dead" && this.hitPaddle(p2)) hitPlayer = 1;

        if (this.lastRot > 4) {
            this.rot = (this.rot + 1) % 4;
            this.lastRot = 0;
        }

        this.lastRot++;
        return hitPlayer;
    }

    shouldDestroy() {
        return (this.pos.x < -this.width || this.pos.x > WIDTH);
    }

    bounceWalls() { //Bounce off floor and ceiling
        if ((this.pos.y <= 0 && this.vel.y < 0) || (this.pos.y >= HEIGHT - this.height && this.vel.y > 0)) {
            this.vel.y *= -1;
        }
    }

    hitPaddle(p) {
        return this.hitRect(this.pos, p);

    }

    hitRect(pos, p, w, h) {
        if (p instanceof Player) {
            return (pos.x + this.width >= p.pos.x && pos.x <= p.pos.x + p.width && //Is inbtwn left and right of paddle
                pos.y + this.height >= p.pos.y && pos.y <= p.pos.y + p.height) //Is inbtwn top and bottom of paddle
        } else {
            return (pos.x + this.width >= p.x && pos.x <= p.x + w && //Is inbtwn left and right of paddle
                pos.y + this.height >= p.y && pos.y <= p.y + h) //Is inbtwn top and bottom of paddle
        }
    }

    serialize() {
        return {
            'name': 'fireball',
            'x': this.pos.x,
            'y': this.pos.y,
            'vx': this.vel.x,
            'vy': this.vel.y,
            'width': this.width,
            'height': this.height,
            'speed': this.speed,
            'extra': {
                'rot': this.rot
            }
        };
    }
}

class Powerup {
    constructor(name, pos) {
        this.name = name;
        this.collected = false;
        if (name == "Fire") {
            this.width = 41.6;
            this.height = 40;
        }

        if (pos == "center") {
            this.pos = new Vector(WIDTH / 2 - this.width / 2, HEIGHT / 2 - this.height / 2);
        }
    }

    serialize() {
        return {
            'name': this.name,
            'collected': this.collected,
            'x': this.pos.x,
            'y': this.pos.y,
            'width': this.width,
            'height': this.height
        };
    }
}

class Player {
    constructor(aOrB) {
        this.aOrB = aOrB;
        this.score = 0;
        this.width = 20;
        this.height = 50;
        this.powerup = null;

        if (this.aOrB == 'A') { //Mario dimensions
            this.displayWidth = 24;
            this.displayHeight = 50;
        }
        if (this.aOrB == 'B') { //Yoshi dimensions
            this.displayWidth = 34;
            this.displayHeight = 50;
        }
        let xPos = 40;
        if (this.aOrB == 'B') {
            xPos = WIDTH - this.width - 40;
        }
        this.pos = new Vector(xPos, HEIGHT / 2 - (this.height / 2)); //The x and y of the top right corner of the paddle
        this.up = false; //Is the up key pressed
        this.down = false; //Is the down key pressed
        this.speed = .4; //Vertical movement speed
    }

    setPowerup(p) {
        this.powerup = p.name;
    }

    reset() {
        this.powerup = null;
        // this.pos.y = HEIGHT / 2 - (this.height / 2);
        // this.up = false;
        // this.down = false;
    }

    setY(y) {
        if (y < this.pos.y) this.up = true; //If the player is moving, set these to true, so the ball bounces correctly
        else if (y > this.pos.y) this.down = true;
        else {
            this.up = false;
            this.down = false;
        }

        this.pos.y = y;
        this.pos.y = Math.max(Math.min(HEIGHT - this.height, this.pos.y), 0); //Constrain vertical position again, just incase!
    }

    hit() {
        this.powerup = "dead";
    }

    serialize() {
        this.modX = this.pos.x;
        if (this.aOrB == 'A') this.modX += 3; //Acounting for the different transparency in each sprite
        else this.modX -= 7;
        let name = 'player' + this.aOrB;
        if (this.powerup == "Fire") name += "Fire";
        return {
            'name': name,
            'x': this.modX,
            'y': this.pos.y,
            'width': this.displayWidth,
            'height': this.displayHeight,
            'powerup': this.powerup
        };
    }
}

class Game {
    constructor() {
        this.players = [new Player('A'), new Player('B')];
        this.ball = new Ball(8, 8);
        this.fireballs = [];

        this.lastPlayerHit = -1;
        this.powerups = [new Powerup("Fire", "center")];


        this.countingDown = true;
        this.countdownTime = 3;
        this.countdownText = new Text("3", WIDTH / 2, HEIGHT * .25, 70);
        this.countdownInterval;
        this.beginCountdown();

        this.winnerText = new Text("WINS!", WIDTH / 2, HEIGHT * .25, 70);
        this.showingWinner = false;
        this.gameHasEnded = false;
    }

    beginCountdown() {
        this.ball.vel.mult(0); //Stop ball moving during countdown
        this.countdownInterval = setInterval(() => { //Display Countdown for 3 seconds
            this.countdownTime--;
            this.countdownText.text = this.countdownTime > 0 ? this.countdownTime : "START";
            if (this.countdownTime < 0) {
                clearInterval(this.countdownInterval);
                this.countdownTime = 3;
                this.countdownText.text = "3";
                this.countingDown = false;
                this.resetGame();
            }
        }, 1000);
    }

    resetGame() {
        this.lastPlayerHit = -1;
        this.fireballs = [];
        this.powerups = [new Powerup("Fire", "center")];
        this.players[0].reset();
        this.players[1].reset();
        this.ball.reset();
    }

    update() {
        if (!this.countingDown && !this.showingWinner) {
            const bouncedOff = this.ball.update(this.players[0], this.players[1]);

            for (let i = this.fireballs.length - 1; i >= 0; i--) {
                const fireball = this.fireballs[i];
                if (fireball.shouldDestroy()) {
                    this.fireballs.splice(i, 1);
                } else {
                    const hit = fireball.update(this.players[0], this.players[1]);
                    if (hit > -1) this.players[hit].hit();
                }
            }

            if (bouncedOff > -1) this.lastPlayerHit = bouncedOff;
            for (let powerup of this.powerups) {
                if (!powerup.collected && this.ball.hitPowerup(powerup) && this.lastPlayerHit > -1) {
                    powerup.collected = true;
                    this.players[this.lastPlayerHit].setPowerup(powerup);
                    console.log(`Player ${this.lastPlayerHit} got a powerup!`);
                }
            }
        }
        const scored = this.ball.checkScore();

        if (scored[0] == true && !this.countingDown && !this.showingWinner) {
            if (scored[1] < WIDTH / 2) this.players[1].score++;
            else this.players[0].score++;

            const winner = this.winner();
            if (winner == -1) { //Someone scored but game isn't over
                this.countingDown = true;
                this.beginCountdown();
            } else { //Someone has won
                this.winnerText.text = `W${winner}`;
                this.showingWinner = true;
                setTimeout(() => {
                    this.endGame()
                }, 2500);
            }
        }

        let movingSprites = [];
        if (!this.countingDown && !this.showingWinner) movingSprites.push(this.ball.serialize());
        movingSprites = movingSprites.concat(this.fireballs.map(f => f.serialize()));

        const gameData = {
            "sprites": [
                this.players[0].serialize(), //Make sure the players stay in this order!
                this.players[1].serialize()
            ],
            "score": [this.players[0].score, this.players[1].score],
            "powerups": this.powerups.map(p => p.serialize()),
            "movingSprites": movingSprites,
            "text": []
        };
        if (this.countingDown) gameData.text.push(this.countdownText.serialize());
        if (this.showingWinner) gameData.text.push(this.winnerText.serialize());

        return gameData;
    }

    endGame() {
        this.gameHasEnded = true;
        this.showingWinner = false;
    }

    winner() {
        if (this.players[0].score >= 5) {
            return "MARIO";
        } else if (this.players[1].score >= 5) {
            return "YOSHI";
        } else {
            return -1;
        }
    }

    shoot(pIndex) {
        if (this.fireballs.length < 3) {
            const dir = (pIndex == 0) ? 1 : -1;
            let pos = this.players[pIndex].pos.copy();
            if (pIndex == 0) {
                pos.x += this.players[pIndex].width; //Player on the left spawns it in front
            }
            pos.y += this.players[pIndex].height / 2;
            const fireball = new Fireball(pos, dir);
            this.fireballs.push(fireball);
        }
    }

    inp(pIndex, data) {
        switch (data.type) {
            case "yPos":
                this.players[pIndex].setY(data.data);
                break;
            case "shoot":
                this.shoot(pIndex);
        }
    }
}


class Room {
    constructor(a, b) {
        this.roomId = a.id + b.id; //This makes sure every roomId is unique, because ids always are
        this.clientASocket = a;
        this.clientBSocket = b;
        this.game = new Game();
        console.log("Joining room");
        this.joinRoom();
    }

    update() {
        const gameData = this.game.update();
        if (this.game.gameHasEnded) {
            this.leaveRoom();
        }
        io.sockets.to(this.roomId).emit('gameData', gameData);
    }

    clientDisconnected(id) {
        if (this.clientASocket.id == id) this.leaveRoom(this.clientBSocket.id);
        else if (this.clientBSocket.id == id) this.leaveRoom(this.clientASocket.id);
        else console.log("Tried disconnecting a client who wasn't here!");
    }

    leaveRoom(id) {
        io.sockets.to(this.roomId).emit('status', 'menu');
        if (!id) {
            this.clientASocket.leave(this.roomId);
            this.clientBSocket.leave(this.roomId);
        } else {
            if (id == this.clientASocket.id) this.clientASocket.leave(this.roomId);
            else if (id == this.clientBSocket.id) this.clientBSocket.leave(this.roomId);
            else console.log("In leaveRoom, the id to leave was neither clientA or B!")
        }
        rooms.splice(rooms.indexOf(this), 1); //Delete the room now that players are gone
    }

    joinRoom() {
        this.clientASocket.join(this.roomId);
        this.clientBSocket.join(this.roomId);

        this.clientASocket.emit('joined', "Mario");
        this.clientBSocket.emit('joined', "Yoshi");
    }

    contains(id) {
        return (this.clientASocket.id == id || this.clientBSocket.id == id);
    }

    recievedInp(id, data) {
        const playerIndex = this.clientASocket.id == id ? 0 : 1;
        this.game.inp(playerIndex, data);
    }
}


function addToQueue(socket) {
    if (clientsQueue.indexOf(socket) == -1) {
        if (clientsQueue.length <= 1) {
            clientsQueue.push(socket);
            socket.emit('status', 'waiting');

            let ids = [];
            for (let s of clientsQueue) ids.push(s.id);

            console.log(`Queue: ${ids}`);
        }
        if (clientsQueue.length >= 2) {
            let room = new Room(clientsQueue[0], clientsQueue[1]);
            rooms.push(room);

            let ids = [];
            for (let s of clientsQueue) ids.push(s.id);

            console.log(`Queue Cleared: ${ids}`);
            clientsQueue.splice(0, 2);
        }
    }
}

function roomOf(socket) {
    for (let room of rooms) {
        if (room.contains(socket.id)) {
            return room;
        }
    }
    return false;
}

function removeFromQueue(socket) {
    clientsQueue.splice(clientsQueue.indexOf(socket));
}

io.sockets.on('connection', socket => {
    console.log(`We have a new client: ${socket.id}`);

    socket.on('addToQueue', () => {
        addToQueue(socket);
    });

    socket.on('yPos', y => {
        const room = roomOf(socket);
        if (room != false) {
            const data = {
                type: 'yPos',
                data: y
            }
            room.recievedInp(socket.id, data);
        }
    });

    socket.on('shoot', () => {
        const room = roomOf(socket);
        if (room != false) {
            const data = {
                type: 'shoot'
            }
            room.recievedInp(socket.id, data);
        }
    });

    socket.on('disconnect', () => {
        const room = roomOf(socket);
        if (clientsQueue.indexOf(socket) >= 0) {
            removeFromQueue(socket); //If they disconnect in queue, remove them from queue
            console.log(`Client ${socket.id} has disconnected from queue`);
        } else if (room != false) { //If they are in game
            room.clientDisconnected(socket.id); //end that game and kick out the other client
            console.log(`Client ${socket.id} has disconnected from a game`);
        } else {
            console.log(`Client ${socket.id} has disconnected from the menu`);
        }
    });
});

let nextTime = Date.now();

function gameLoop() {
    let now = Date.now();
    if (now >= nextTime) {
        deltaTime = now - lastFrameTime;
        lastFrameTime = now;
        for (let room of rooms) {
            room.update();
        }
        nextTime = now + fps;
        const timeToWait = nextTime - Date.now(); //Exactly how long to wait until the next frame
        setTimeout(gameLoop, timeToWait * timingAccuracy); //Because JS timers sometimes take extra, decreause to be more precise
    } else {
        const timeToWait = nextTime - now;
        setTimeout(gameLoop, timeToWait * timingAccuracy);
    }
};
gameLoop();

/*
Client connects

Make all socket.on events, and some of them will locate which room 
that socket is in, and run a function telling that room to tell the 
game to do whatever the event is (up/down, disconnect)

Client clicks join buton

Sends message to server

Server puts client in queue

Server tells client it is waiting

Once queue fills up, place both players into game room

Rooms will update and send messages at 60 fps

Game ends or a player gets disconnected

Send message to clients to go back to menu screen
*/