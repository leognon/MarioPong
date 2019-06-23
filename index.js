//Credit to Daniel Shiffman at https://github.com/CodingTrain/website/tree/master/Node/sockets for some of this code
const express = require('express');
const app = express();
const server = app.listen(process.env.PORT || 3000);
const io = require('socket.io')(server)
app.use(express.static('public'));
console.log("Server started");

const fps = 1000 / 60;
let date = new Date();
let lastFrameTime = date.getTime();
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

    magSq() {
        return (this.x * this.x) + (this.y * this.y);
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
        // this.pos = new Vector((WIDTH / 2) + (this.width / 2), (HEIGHT / 2) + (this.height / 2));
        this.speed = .3;
        this.reset();
        // let maxAng = Math.PI / 2.5;
        // let ang = (Math.random() * (maxAng * 2)) - (maxAng);
        // if (Math.random() < .5) ang += Math.PI;
        // this.vel = new Vector(Math.cos(ang) * this.speed, Math.sin(ang) * this.speed);
    }

    fixMag() {
        this.vel.setMag(this.speed);
    }

    reset() {
        this.pos = new Vector((WIDTH / 2) + (this.width / 2), (HEIGHT / 2) + (this.height / 2));
        let ang = (Math.random() * (this.maxAng * 2)) - (this.maxAng);
        if (Math.random() < .5) ang += Math.PI;
        this.vel = new Vector(Math.cos(ang) * this.speed, Math.sin(ang) * this.speed);
        this.prevPos = this.pos.copy();
        this.prevVel = new Vector();
    }

    update(p1, p2) {
        this.prevPos = this.pos.copy();
        this.prevVel = this.vel.copy();
        // const fixedVel = this.vel.copy().mult(deltaTime);
        this.vel.setMag(deltaTime * this.speed);
        this.pos.add(this.vel);

        this.bounceWalls();
        this.pos.y = Math.max(Math.min(HEIGHT - this.height, this.pos.y), 0); //Constrain vertical position (can't go into floor)
        this.hitPaddle(p1, -1);
        this.hitPaddle(p2, 1);


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
        if (desDir == this.vel.x / Math.abs(this.vel.x) && this.hitRect(this.pos, p)) {
            const xChanged = new Vector(this.prevPos.x + this.prevVel.x, this.prevPos.y); //Testing to see if it is bouncing of the side
            const yChanged = new Vector(this.prevPos.x, this.prevPos.y + this.prevVel.y); //Or the top/bottom

            if (this.hitRect(xChanged, p)) {
                if ((desDir == -1 && this.pos.x > p.pos.x + (p.width * .25)) || //It will only bounce off the front quarter of the paddle
                    desDir == 1 && this.pos.x + this.width < p.pos.x + (p.width * .75)) {
                    const horzDist = (this.pos.y + this.height / 2) - (p.pos.y + p.height / 2);
                    const maxDist = (p.height / 2) + (this.height / 2);
                    const ang = (horzDist / maxDist) * this.maxAng;
                    this.vel.set(Math.cos(ang) * this.speed * -desDir, Math.sin(ang) * this.speed);
                }
            }
            if (this.hitRect(yChanged, p)) {
                if (this.pos.y + this.height / 2 > p.pos.y + p.height / 2) { //If its hitting the bottom
                    this.vel.y = Math.abs(this.vel.y); //Mkae it bounce down
                    if (p.down) { //If paddle is moving up, bounce it up more
                        const nextPos = new Vector(this.pos.x + this.vel.x, this.pos.y + this.vel.y);
                        if (this.hitRect(nextPos, nextPos, p.width, p.height)) {
                            this.pos.y += p.speed;
                            this.vel.y *= 1.3;
                        }
                    }
                } else { //If its hitting the top, make it bounce up
                    this.vel.y = -Math.abs(this.vel.y);
                    if (p.up) {
                        const nextPos = new Vector(this.pos.x - this.vel.x, this.pos.y + this.vel.y);
                        if (this.hitRect(nextPos, nextPos, p.width, p.height)) {
                            this.pos.y -= p.speed;
                            this.vel.y *= 1.3;
                        }
                    }
                }
            }
        }
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

    reset() {
        this.pos.y = HEIGHT / 2 - (this.height / 2);
        this.up = false;
        this.down = false;
    }

    update() {
        if (this.up) this.pos.y -= (this.speed * deltaTime); //Move up
        if (this.down) this.pos.y += (this.speed * deltaTime); //Move down
        this.pos.y = Math.max(Math.min(HEIGHT - this.height, this.pos.y), 0); //Constrain vertical position
    }

    serialize() {
        this.modX = this.pos.x;
        if (this.aOrB == 'A') this.modX += 3; //Acounting for the different transparency in each sprite
        else this.modX -= 7;
        return {
            'name': 'player' + this.aOrB,
            'x': this.modX,
            'y': this.pos.y,
            'width': this.displayWidth,
            'height': this.displayHeight
        };
    }
}

class Game {
    constructor() {
        this.players = [new Player('A'), new Player('B')];
        this.ball = new Ball(8, 8);
        this.countingDown = true;
        this.countdownTime = 3;
        this.countdownText = new Text("3", WIDTH / 2, HEIGHT / 2, 70);
        this.countdownInterval;
        this.beginCountdown();
        this.winnerText = new Text("WINS!", WIDTH / 2, HEIGHT / 2, 70);
        this.showingWinner = false;
        this.gameHasEnded = false;
    }

    beginCountdown() {
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
        this.ball.reset();
    }

    update() {
        this.players[0].update();
        this.players[1].update();
        if (!this.countingDown && !this.showingWinner) {
            this.ball.update(this.players[0], this.players[1]);
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

        const gameData = {
            "sprites": [
                this.ball.serialize(),
                this.players[0].serialize(),
                this.players[1].serialize()
            ],
            "score": [this.players[0].score, this.players[1].score],
            "text": []
        };
        if (this.countingDown) {
            gameData.text.push(this.countdownText.serialize());
        }
        if (this.showingWinner) {
            gameData.text.push(this.winnerText.serialize());
        }

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

    inp(pIndex, data) {
        switch (data.type) {
            case "up":
                this.players[pIndex].up = data.data;
                break;
            case "down":
                this.players[pIndex].down = data.data;
                break;
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
        this.clientASocket.emit('marioOrYoshi', "Mario");
        this.clientBSocket.emit('marioOrYoshi', "Yoshi");
    }

    update() {
        const gameData = this.game.update();
        if (this.game.gameHasEnded) {
            this.leaveRoom();
        }
        io.sockets.to(this.roomId).emit('gameData', gameData);
    }

    // addFunctions(socket) {
    //     socket.on('up', pressed => {
    //         // let playerIndex;
    //         // if (socket.id == this.clientASocket.id) {
    //         //     playerIndex = 0;
    //         // } else if (socket.id == this.clientBSocket.id) {
    //         //     playerIndex = 1;
    //         // } else {
    //         //     playerIndex = 0;
    //         //     console.log("SOMETHING WENT WRONG" + socket.id);
    //         //     console.log(`Expected A: ${this.clientASocket.id} or B: ${this.clientBSocket.id}`);
    //         // }
    //         // const playerIndex = 0 ? socket.id == this.clientASocket.id : 1;
    //         let playerIndex = 0; // ? socket.id == this.clientASocket.id : 1;
    //         if (socket.id == this.clientBSocket.id) playerIndex = 1;
    //         // console.log(playerIndex);
    //         this.game.players[playerIndex].up = pressed;
    //     });
    //     socket.on('down', pressed => {
    //         // console.log(socket.id);
    //         // let playerIndex;
    //         // if (socket.id == this.clientASocket.id) {
    //         //     playerIndex = 0; 
    //         //     // console.log("Player A");
    //         // } else if (socket.id == this.clientBSocket.id) {
    //         //     playerIndex = 1;
    //         //     // console.log("Player B");
    //         // } else {
    //         //     playerIndex = 0;
    //         //     console.log("SOMETHING WENT WRONG" + socket.id);
    //         //     console.log(`Expected A: ${this.clientASocket.id} or B: ${this.clientBSocket.id}`);
    //         // }

    //         let playerIndex = 0; // ? socket.id == this.clientASocket.id : 1;
    //         if (socket.id == this.clientBSocket.id) playerIndex = 1;
    //         this.game.players[playerIndex].down = pressed;
    //     });
    //     socket.on('disconnect', () => {
    //         socket = null;
    //         this.leaveRoom(); 
    //     });
    // }

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
        io.sockets.to(this.roomId).emit('status', 'joined');
    }

    contains(id) {
        return (room.clientASocket.id == id || room.clientBSocket.id == id)
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
            for (s of clientsQueue) ids.push(s.id);

            console.log(`Queue: ${ids}`);
        }
        if (clientsQueue.length >= 2) {
            let room = new Room(clientsQueue[0], clientsQueue[1]);
            rooms.push(room);

            let ids = [];
            for (s of clientsQueue) ids.push(s.id);

            console.log(`Queue Cleared: ${ids}`);
            clientsQueue.splice(0, 2);
        }
    }
}

function roomOf(socket) {
    for (room of rooms) {
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
        // io.sockets.connected[socket.id].emit('status', 'waiting');
    });

    socket.on('pauseToDebug', () => {
        console.log("Debug!");
    });

    socket.on('up', pressed => {
        const room = roomOf(socket);
        if (room != false) {
            const data = {
                type: 'up',
                data: pressed
            }
            room.recievedInp(socket.id, data);
        }
        // let playerIndex = 0;
        // if (socket.id == this.clientBSocket.id) playerIndex = 1;
        // this.game.players[playerIndex].up = pressed;
    });
    socket.on('down', pressed => {
        const room = roomOf(socket);
        if (room != false) {
            const data = {
                type: 'down',
                data: pressed
            }
            room.recievedInp(socket.id, data);
        }
        // let playerIndex = 0;
        // if (socket.id == this.clientBSocket.id) playerIndex = 1;
        // this.game.players[playerIndex].down = pressed;
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

    // io.sockets.to(socket.id).emit('status', 'waiting');
    // socket.emit('status', 'waiting');

    // io.sockets.connected[socket.id].emit('status', 'waiting'); //Emits to one socket

    // if (!game.clientA) game.clientA = socket.id;
    // else if (!game.clientB) game.clientB = socket.id;
    // else {
    //     io.sockets.socket(socket.id).emit('extraPlayer');
    // }
});

setInterval(() => {
    date = new Date();
    deltaTime = date.getTime() - lastFrameTime;
    if (deltaTime > fps + 4) {
        console.log(`Lag! A frame just took ${deltaTime}!`);
    }
    lastFrameTime = date.getTime();
    for (room of rooms) {
        room.update();
    }
}, fps);
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