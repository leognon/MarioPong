//Credit to Daniel Shiffman at https://github.com/CodingTrain/website/tree/master/Node/sockets for some of the node.js code
//This project was started June 10, 2019
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

let online = 0;
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

    mult(a, b = null) {
        if (a instanceof Vector) {
            this.x *= a.x;
            this.y *= a.y;
        } else if (b == null) {
            this.x *= a;
            this.y *= a;
        } else {
            this.x *= a;
            this.y *= b;
        }
    }

    setMag(m) {
        const currMagSq = (this.x * this.x) + (this.y * this.y);
        if (currMagSq > 0 && m * m != currMagSq) {
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
        this.respawning = false;
        this.reset();
    }

    fixMag() {
        this.vel.setMag(this.speed);
    }

    startRespawning() {
        this.vel.mult(0);
        this.respawning = true;
    }

    reset(startY = (HEIGHT / 2), maxY = false) {
        this.respawning = false;
        this.speed = this.baseSpeed;
        this.pos = new Vector((WIDTH / 2) - (this.width / 2), startY - (this.height / 2));

        let ang;
        if (maxY === false) {
            ang = (Math.random() * (this.maxAng * 2)) - (this.maxAng);
        } else {
            maxY -= 25;
            const gapY = maxY - (this.pos.y + this.height / 2);
            const gapX = WIDTH - (this.pos.x + this.width / 2) - 50; //The space from its pos to the player
            const maxAng = Math.atan2(gapY, gapX);
            const minAng = -Math.atan2(gapY + maxY, gapX);
            const range = maxAng - minAng;
            ang = (Math.random() * range) + minAng;
        }

        this.vel = new Vector(Math.cos(ang) * this.speed, Math.sin(ang) * this.speed);
        if (Math.random() < .5) this.vel.x *= -1;
        this.prevPos = this.pos.copy();
        this.prevVel = new Vector();
    }

    update(p1, p2) {
        let bouncedOffAnything = false;
        let bouncedOff = -1;
        if (!this.respawning) {
            this.prevPos = this.pos.copy();
            this.prevVel = this.vel.copy();
            this.vel.setMag(deltaTime * this.speed);

            this.pos.add(this.vel);

            if (this.bounceWalls()) bouncedOffAnything = true;
            this.pos.y = Math.max(Math.min(HEIGHT - this.height, this.pos.y), 0); //Constrain vertical position (can't go into floor)

            if (p1.powerup != "dead" && this.hitPaddle(p1, -1)) {
                bouncedOff = 0;
                bouncedOffAnything = true;
            }
            if (p2.powerup != "dead" && this.hitPaddle(p2, 1)) {
                bouncedOff = 1;
                bouncedOffAnything = true;
            }

            if (this.vel.magSq() > 225) { //Make sure the ball never goes too fast (can't go above 15 speed)
                this.vel.setMag(15);
            }
            if (this.vel.x < .3 && this.vel.x > -.3) { //Make sure the ball never goes too vertical
                if (this.vel.x == 0) {
                    if (this.pos.x > WIDTH / 2) this.vel.x += .03;
                    else this.vel.x -= .03
                } else if (this.vel.x >= 0) {
                    this.vel.x += .05;
                } else {
                    this.vel.x -= .05;
                }
                this.fixMag();
            }
        }
        return [bouncedOff, bouncedOffAnything];
    }

    bounceWalls() { //Bounce off floor and ceiling
        if ((this.pos.y <= 0 && this.vel.y < 0) || (this.pos.y >= HEIGHT - this.height && this.vel.y > 0)) {
            this.vel.y *= -1;
            return true;
        }
        return false;
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
                    if (Math.abs(this.vel.y) / this.vel.y == -1) hasBounced = true; //Only bounced if dir changed
                    this.vel.y = Math.abs(this.vel.y); //Make it bounce down
                    if (p.down) { //If paddle is moving up, bounce it up more
                        const nextPos = new Vector(this.pos.x + this.vel.x, this.pos.y + this.vel.y);
                        if (this.hitRect(nextPos, nextPos, p.width, p.height)) {
                            this.pos.y += (p.speed * deltaTime); //Push the ball down

                            this.vel.set(this.vel.x, this.vel.y * 1.3);
                            this.speed *= 1.1;
                        }
                    }
                } else { //If its hitting the top
                    if (Math.abs(this.vel.y) / this.vel.y == 1) hasBounced = true; //Only bounced if dir changed
                    this.vel.y = -Math.abs(this.vel.y); //make it bounce up
                    if (p.up) {
                        const nextPos = new Vector(this.pos.x - this.vel.x, this.pos.y + this.vel.y);
                        if (this.hitRect(nextPos, nextPos, p.width, p.height)) {
                            this.pos.y -= (p.speed * deltaTime); //Push the ball up

                            this.vel.set(this.vel.x, this.vel.y * 1.3);
                            this.speed *= 1.1;
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

class Saw {
    constructor(y, dir) {
        this.speed = .002;
        this.width = 100;
        this.height = 100;
        const extraSpace = 10;
        const x = (dir == 1) ? -this.width - extraSpace : WIDTH + extraSpace;
        this.pos = new Vector(x, y);
        this.dir = dir;
        this.vel = new Vector(this.dir * this.speed, 0);
        this.rot = 0;
        this.rotSpeed = .1;
    }

    update(p1, p2) {
        let playerHit = -1;
        let hitPlayerWithStar = false;

        if (this.hitPaddle(p1) && p1.powerup != "dead") {
            if (p1.powerup != "Star") playerHit = 0; //If it hit a vulnerable player
            else hitPlayerWithStar = true; //If it hit an invincible player
        }
        if (this.hitPaddle(p2) && p2.powerup != "dead") {
            if (p2.powerup != "Star") playerHit = 1; //If it hit a vulnerable player
            else hitPlayerWithStar = true; //If it hit an invincible player
        }
        if (hitPlayerWithStar) playerHit = -2;

        this.vel.setMag(this.speed * deltaTime);
        this.pos.add(this.vel);
        this.rot += this.rotSpeed;
        this.rot %= Math.PI * 2;

        return playerHit;
    }

    hitPaddle(p) {
        return this.circleToRect(this.pos.x, this.pos.y, this.width * .5, p.pos.x, p.pos.y, p.width, p.height);
    }

    circleToRect(cx, cy, cr, rx, ry, rw, rh) {
        cx += cr; //Account for the pos being the top-left corner
        cy += cr;
        const closestX = Math.min(Math.max(rx, cx), rx + rw); //Find the closest point on the rect
        const closestY = Math.min(Math.max(ry, cy), ry + rh);
        const xDist = cx - closestX;
        const yDist = cy - closestY;
        return (xDist * xDist + yDist * yDist < cr * cr); //Check if the point is close enough to the cirlce
    }

    startMoving() {
        this.vel = new Vector(this.dir * this.speed, 0);
    }

    stopMoving() {
        this.vel.mult(0);
    }

    serialize() {
        return {
            'name': 'saw',
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

class Fireball {
    constructor(pos, dir) {
        this.width = 40;
        this.height = 40;
        this.rot = 0;
        this.lastRot = 0;
        this.pos = new Vector(pos.x, pos.y - (this.height / 2));
        if (dir == -1) this.pos.x -= this.width;
        this.speed = .25;
        this.vel = new Vector(dir * this.speed * .5, this.speed * 0.866); //The fireball at a -60° ang
    }

    fixMag() {
        this.vel.setMag(this.speed);
    }

    update(p1, p2) {
        let bouncedOffAnything = false;
        let hitPlayer = -1;

        this.vel.setMag(deltaTime * this.speed);
        this.pos.add(this.vel);

        if (this.bounceWalls()) bouncedOffAnything = true;
        this.pos.y = Math.max(Math.min(HEIGHT - this.height, this.pos.y), 0); //Constrain vertical position (can't go into floor)
        if (p1.powerup != "dead" && this.hitPaddle(p1)) hitPlayer = 0;
        if (p2.powerup != "dead" && this.hitPaddle(p2)) hitPlayer = 1;

        if (this.lastRot > 4) {
            this.rot = (this.rot + (Math.PI * .5)) % (Math.PI * 2);
            this.lastRot = 0;
        }

        this.lastRot++;
        return [hitPlayer, bouncedOffAnything];
    }

    shouldDestroy() {
        return (this.pos.x < -this.width || this.pos.x > WIDTH);
    }

    bounceWalls() { //Bounce off floor and ceiling
        if ((this.pos.y <= 0 && this.vel.y < 0) || (this.pos.y >= HEIGHT - this.height && this.vel.y > 0)) {
            this.vel.y *= -1;
            return true;
        }
        return false;
    }

    stopMoving() {
        this.vel.mult(0);
    }

    hitPaddle(p) {
        return this.circleToRect(this.pos.x, this.pos.y, this.width * .5, p.pos.x, p.pos.y, p.width, p.height);
    }

    circleToRect(cx, cy, cr, rx, ry, rw, rh) {
        cx += cr; //Account for the pos being the top-left corner
        cy += cr;
        const closestX = Math.min(Math.max(rx, cx), rx + rw); //Find the closest point on the rect
        const closestY = Math.min(Math.max(ry, cy), ry + rh);
        const xDist = cx - closestX;
        const yDist = cy - closestY;
        return (xDist * xDist + yDist * yDist < cr * cr); //Check if the point is close enough to the cirlce
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

class Shell {
    constructor(x, y) {
        this.width = 43.2;
        this.height = 33.6;
        this.pos = new Vector(x - (this.width / 2), y);
        this.speed = .15;
        this.hasBounced = false;
        this.vel = new Vector();
    }

    fixMag() {
        this.vel.setMag(this.speed);
    }

    update(p1, p2, ball, canBounce) {
        let bouncedOffAnything = false;
        let hitPlayer = -1;

        this.vel.setMag(deltaTime * this.speed);
        this.pos.add(this.vel);

        if (this.bounceWalls()) bouncedOffAnything = true;
        this.pos.y = Math.max(Math.min(HEIGHT - this.height, this.pos.y), 0); //Constrain vertical position (can't go into floor)


        if (canBounce && !this.hasBounced && this.circleToRect(this.pos.x, this.pos.y, this.width * .4, ball.pos.x, ball.pos.y, ball.width, ball.height)) {
            this.vel.set(ball.vel.x, ball.vel.y);
            this.hasBounced = true;
            bouncedOffAnything = true;
        }

        if (p1.powerup != "dead" && this.hitPaddle(p1)) hitPlayer = 0;
        if (p2.powerup != "dead" && this.hitPaddle(p2)) hitPlayer = 1;

        return [hitPlayer, bouncedOffAnything];
    }

    shouldDestroy() {
        return (this.pos.x < -this.width || this.pos.x > WIDTH);
    }

    bounceWalls() { //Bounce off floor and ceiling
        if ((this.pos.y <= 0 && this.vel.y < 0) || (this.pos.y >= HEIGHT - this.height && this.vel.y > 0)) {
            this.vel.y *= -1;
            return true;
        }
        return false;
    }

    stopMoving() {
        this.vel.mult(0);
    }

    hitPaddle(p) {
        return this.circleToRect(this.pos.x, this.pos.y, this.width * .5, p.pos.x, p.pos.y, p.width, p.height);
    }

    circleToRect(cx, cy, cr, rx, ry, rw, rh) {
        cx += cr; //Account for the pos being the top-left corner
        cy += cr;
        const closestX = Math.min(Math.max(rx, cx), rx + rw); //Find the closest point on the rect
        const closestY = Math.min(Math.max(ry, cy), ry + rh);
        const xDist = cx - closestX;
        const yDist = cy - closestY;
        return (xDist * xDist + yDist * yDist < cr * cr); //Check if the point is close enough to the cirlce
    }

    serialize() {
        return {
            'name': 'shell',
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

class Lava {
    constructor() {
        this.width = 72;
        this.height = 24;
        this.pos = new Vector(WIDTH, HEIGHT);
        this.vel = new Vector(-.05, -.003);
        this.speed = this.vel.mag();
    }

    update(p1, p2, ball) {
        let hit = [false, false, false];

        this.vel.setMag(deltaTime * this.speed);
        this.pos.add(this.vel);
        if (this.pos.x < -this.width) {
            this.pos.x = WIDTH; //Make it wrap aorund
        }
        this.pos.y = Math.max(-15, this.pos.y); //Max height
        if (this.pos.y < HEIGHT - 15) { //Lava is only deadly after a certain point
            if (p1.powerup != "dead" && p1.pos.y + p1.height > this.pos.y) hit[0] = true;
            if (p2.powerup != "dead" && p2.pos.y + p2.height > this.pos.y) hit[1] = true;
        }
        if (ball.pos.y + ball.height > this.pos.y) hit[2] = true;

        return hit;
    }

    riseFast() {
        this.vel.set(-.05, -.18);
        this.speed = this.vel.mag();
    }

    stopMoving() {
        this.vel.mult(0);
    }

    startMoving() {
        this.vel = new Vector(-.05, -.003);
    }

    serialize() {
        return {
            'name': 'lava',
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

class Powerup {
    constructor(name, pos) {
        this.name = name;
        this.collected = false;
        if (name == "Fire") {
            this.width = 41.6;
            this.height = 40;
        } else if (name == "Big") {
            this.width = 43.2;
            this.height = 36.8;
        } else if (name == "Small") {
            this.width = 41.4;
            this.height = 39.6;
        } else if (name == "Star") {
            this.width = 40;
            this.height = 47.5;
        } else if (name == "Copter") {
            this.width = 39.6;
            this.height = 41.8;
        }

        if (pos == "center") {
            this.pos = new Vector((WIDTH / 2) - (this.width / 2), (HEIGHT / 2) - (this.height / 2));
        } else if (pos == "left") {
            this.pos = new Vector((WIDTH / 3) - (this.width / 2), (HEIGHT / 3) - (this.height / 2));
        } else if (pos == "right") {
            this.pos = new Vector((WIDTH * 2 / 3) - (this.width / 2), (HEIGHT * 2 / 3) - (this.height / 2));
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
    constructor(aOrB, name) {
        this.aOrB = aOrB;
        this.playerName = name
        this.score = 0;
        this.baseWidth = 20;
        this.baseHeight = 50;

        this.width = this.baseWidth;
        this.height = this.baseHeight;

        this.sizeMult = 1;
        this.powerup = null;

        if (this.aOrB == 'A') { //Mario dimensions
            this.baseDisplayHeight = this.height;
            this.baseDisplayWidth = this.baseDisplayHeight * (12 / 25);
        }
        if (this.aOrB == 'B') { //Yoshi dimensions
            this.baseDisplayHeight = this.height;
            this.baseDisplayWidth = this.baseDisplayHeight * (11 / 16);
        }
        this.displayWidth = this.baseDisplayWidth;
        this.displayHeight = this.baseDisplayHeight;

        let xPos = 50;
        if (this.aOrB == 'B') {
            xPos = WIDTH - (this.width + 50);
        }
        this.pos = new Vector(xPos, HEIGHT / 2 - (this.height / 2)); //The x and y of the top right corner of the paddle
        this.up = false; //Is the up key pressed
        this.down = false; //Is the down key pressed
        this.speed = .4; //Vertical movement speed
        this.justShot = false;
    }

    shoot() {
        this.justShot = true;
    }

    setPowerup(p) {
        this.powerup = p.name;
        if (this.powerup == "Big") {
            this.sizeMult = 1.3;

            this.width = this.baseWidth * this.sizeMult;
            this.height = this.baseHeight * this.sizeMult;
            this.displayWidth = this.baseDisplayWidth * this.sizeMult;
            this.displayHeight = this.baseDisplayHeight * this.sizeMult;
        } else if (this.powerup == "Small") {
            this.sizeMult = .8;
            this.width = this.baseWidth * this.sizeMult;
            this.height = this.baseHeight * this.sizeMult;
            this.displayWidth = this.baseDisplayWidth * this.sizeMult;
            this.displayHeight = this.baseDisplayHeight * this.sizeMult;
        }
    }

    reset() {
        this.powerup = null;
        const oldSizeMult = this.sizeMult; //Reset the size
        const margin = 50;
        this.sizeMult = 1;
        this.width = this.baseWidth;
        this.height = this.baseHeight;
        this.displayWidth = this.baseDisplayWidth;
        this.displayHeight = this.baseDisplayHeight;

        if (this.aOrB == 'A') {
            this.pos.x = margin;
        } else if (this.aOrB == 'B') {
            this.pos.x = WIDTH - (margin + this.baseWidth);
        }
        this.pos.y -= (this.sizeMult - oldSizeMult) * this.baseHeight * .5;

    }

    setPos(p) {
        if (p.y < this.pos.y) this.up = true; //If the player is moving, set these to true, so the ball bounces correctly
        else if (p.y > this.pos.y) this.down = true;
        else {
            this.up = false;
            this.down = false;
        }

        this.pos.set(p.x, p.y);
        if (this.powerup != "Copter")
            this.pos.y = Math.max(Math.min(HEIGHT - this.height, this.pos.y), 0); //Constrain vertical position again, just incase!
    }

    hit() {
        this.powerup = "dead";
    }

    serializeScore() {
        return {
            'score': this.score,
            'name': this.playerName
        }
    }

    serialize() {
        this.modX = this.pos.x;
        if (this.aOrB == 'A') this.modX += (this.displayWidth / 6);
        if (this.aOrB == 'B') this.modX -= (this.displayWidth * .25); //Move yoshi over so it displays in the correct place
        let name = 'player' + this.aOrB;
        if (this.powerup == "Fire") name += "Fire";
        if (this.powerup == "Copter") name += "Copter";
        return {
            'name': name,
            'x': this.modX,
            'y': this.pos.y,
            'width': this.displayWidth,
            'height': this.displayHeight,
            'powerup': this.powerup,
        };
    }
}

class Game {
    constructor(aName, bName) {
        this.players = [new Player('A', aName), new Player('B', bName)];
        this.ball = new Ball(8, 8);
        this.fireballs = [];
        this.shells = [];
        this.saws = [];
        this.lava = undefined;
        this.ballStartY = HEIGHT / 2;

        this.lastPlayerHit = -1;
        this.powerups = [];

        this.amtOfRoundTypes = 5;
        this.unusedRounds = [];

        this.countingDown = true;
        this.countdownTime = 3;
        this.countdownText = new Text("3", WIDTH / 2, HEIGHT * .25, 70);
        this.countdownInterval;

        this.winnerText = new Text("WINS!", WIDTH / 2, HEIGHT * .25, 28);
        this.showingWinner = false;
        this.gameHasEnded = false;

        this.initNextRound(true); //Creates the first round
        this.beginCountdown(true); //Starts a countdown, without changing the first round
    }

    initNextRound(firstRound = false) {
        if (!firstRound) this.resetGame();
        if (this.unusedRounds.length <= 0)
            for (let i = 0; i < this.amtOfRoundTypes; i++) this.unusedRounds.push(i); //Makes an array with the possible rounds

        //Picks and removes a random round
        const round = this.unusedRounds.splice(Math.floor(Math.random() * this.unusedRounds.length), 1)[0];

        switch (round) {
            case 0:
                this.powerups = [new Powerup("Fire", "center")];
                break;
            case 1:
                this.powerups = [
                    new Powerup("Big", "left"),
                    new Powerup("Small", "right")
                ];
                break;
            case 2:
                this.shells = [];
                for (let i = 0; i < 5; i++) {
                    const y = (i * (HEIGHT / 5)) + 30;
                    this.shells.push(new Shell(WIDTH / 2, y));
                }
                break;
            case 3:
                this.powerups = [new Powerup("Star", "center")];
                this.saws = [];
                for (let i = 0; i < 3; i++) {
                    const y = (i * (HEIGHT / 3)) + 10;
                    this.saws.push(new Saw(y, 1));
                    this.saws.push(new Saw(y, -1));
                }
                break;
            case 4:
                this.lava = new Lava();
                this.powerups = [new Powerup("Copter", "center")];
                this.ball.reset(HEIGHT / 2, this.lava.pos.y);
                break;
        }
    }

    beginCountdown(firstRound = false) {
        this.fireballs.map(f => f.stopMoving()); //Stop fireballs from moving
        this.shells.map(s => s.stopMoving()); //Stop fireballs from moving
        this.saws.map(s => s.stopMoving()); //Stop saws from moving
        if (this.lava) this.lava.stopMoving();
        this.ball.vel.mult(0); //Stop ball moving during countdown
        this.countdownInterval = setInterval(() => { //Display Countdown for 3 seconds
            this.countdownTime--; //Countdown
            this.countdownText.text = this.countdownTime > 0 ? this.countdownTime : "START"; //Display 3 2 1 START
            if (this.countdownTime < 0) {
                clearInterval(this.countdownInterval);
                this.countdownTime = 3;
                this.countdownText.text = "3"; //Reset countdown stuff
                this.countingDown = false;
                if (!firstRound) this.initNextRound(); //Only create a new round if its not the first
                else {
                    this.saws.map(s => s.startMoving());
                    if (this.lava) {
                        this.lava.startMoving();
                        this.ball.reset(HEIGHT / 2, this.lava.pos.y);
                    } else {
                        this.ball.reset(); //If its the first round, just reset some the ball
                    }
                }
            }
        }, 1000);
    }

    resetGame() {
        this.lastPlayerHit = -1;
        this.fireballs = [];
        this.shells = [];
        this.saws = [];
        this.lava = undefined;
        this.ballStartY = HEIGHT / 2;
        this.powerups = [];

        this.players[0].reset();
        this.players[1].reset();
        this.ball.reset();
    }

    update() {
        let sounds = [];

        if (!this.countingDown && !this.showingWinner) { //If the game is playing
            const bouncedOff = this.ball.update(this.players[0], this.players[1]); //Move the ball and test if it bounced
            if (bouncedOff[1]) sounds.push("bounce"); //If the ball bounced off a wall
            if (bouncedOff[0] > -1) this.lastPlayerHit = bouncedOff[0]; //Who the ball just hit (if it did)
            const canBounce = (this.lastPlayerHit > -1);

            for (let i = this.fireballs.length - 1; i >= 0; i--) {
                const fireball = this.fireballs[i];
                if (fireball.shouldDestroy()) { //Remove firballs out of the screen
                    this.fireballs.splice(i, 1);
                } else {
                    const hit = fireball.update(this.players[0], this.players[1]); //Check if fireball hit player
                    if (hit[0] > -1) { //If it hit a player
                        this.players[hit[0]].hit(); //Remove player who got hit
                        sounds.push("hit");
                    }
                    if (hit[1]) { //If it bounced
                        sounds.push("bounce");
                    }
                }
            }

            for (let i = this.shells.length - 1; i >= 0; i--) {
                const shell = this.shells[i];
                if (shell.shouldDestroy()) { //Remove shells out of the screen
                    this.shells.splice(i, 1);
                } else {
                    const hit = shell.update(this.players[0], this.players[1], this.ball, canBounce); //Check if shell hit player
                    if (hit[0] > -1) {
                        this.players[hit[0]].hit();
                        sounds.push("hit");
                    } //Remove player who got hit
                    if (hit[1]) {
                        sounds.push("bounce");
                    }
                }
            }

            for (let i = this.saws.length - 1; i >= 0; i--) {
                const saw = this.saws[i];
                const hit = saw.update(this.players[0], this.players[1]); //Returns who got hit
                if (hit == -2) { //If it hit -2, that means it hit player with star power
                    this.saws.splice(i, 1); //Destory saw
                } else if (hit > -1) {
                    this.players[hit].hit(); //If saw hit p1
                    sounds.push("die");
                }
            }
            if (this.lava) {
                const hit = this.lava.update(this.players[0], this.players[1], this.ball);
                if (hit[0] && this.players[0].powerup != "Copter") {
                    this.players[0].hit();
                    sounds.push("die");
                }
                if (hit[1] && this.players[1].powerup != "Copter") {
                    this.players[1].hit();
                    sounds.push("die");
                }
                if (hit[2] && !this.ball.respawning) {
                    sounds.push("die");
                    this.ball.startRespawning();
                    this.lastPlayerHit = -1; //Since the ball is resetting
                    setTimeout(() => {
                        if (this.lava.pos.y < this.ballStartY + 25) this.ballStartY /= 2;
                        this.ball.reset(this.ballStartY, this.lava.pos.y);
                    }, 500);
                }
                if (this.players[0].powerup == "dead" && this.players[1].powerup == "dead" && this.lava.pos.y < 50) { //If the lava rises, but no one scores, start next round
                    const winner = this.winner();
                    if (winner == -1) { //Someone scored but game isn't over
                        this.countingDown = true; //Stop games from updating
                        this.beginCountdown();
                    } else { //Someone has won
                        this.winnerText.text = `W${winner}`;
                        this.showingWinner = true; //Stops game from updating
                        this.fireballs.map(f => f.stopMoving());
                        this.saws.map(s => s.stopMoving());
                        this.shells.map(s => s.stopMoving());
                        if (this.lava) this.lava.stopMoving();
                        setTimeout(() => {
                            this.endGame();
                        }, 2500);
                    }
                }
            }

            if (this.lastPlayerHit > -1) {
                for (let powerup of this.powerups) {
                    if (!powerup.collected && this.ball.hitPowerup(powerup)) { //Test if a player just got a powerup
                        sounds.push("collect");
                        powerup.collected = true; //Will stop showing the powerup
                        this.players[this.lastPlayerHit].setPowerup(powerup); //Gives the powerup to that player
                        if (powerup.name == "Copter") {
                            this.ball.startRespawning(); //Stop the ball so no one scores
                            this.lava.riseFast();
                            setTimeout(() => {
                                const losingSide = (this.lastPlayerHit == 0) ? WIDTH + 100 : -100;
                                const whoScored = [true, losingSide];
                                this.score(whoScored);
                            }, 2250);
                        }
                    }
                }
            }

            if (this.players[0].justShot) { //Sound effects for fireball shooting
                sounds.push("shoot");
                this.players[0].justShot = false;
            }
            if (this.players[1].justShot) {
                sounds.push("shoot");
                this.players[1].justShot = false;
            }
        }
        const whoScored = this.ball.checkScore();

        if (whoScored[0] == true && !this.countingDown && !this.showingWinner) { //Check if someone has scored
            this.score(whoScored);
        }

        let movingSprites = [];
        if (!this.countingDown && !this.showingWinner && !this.ball.respawning) movingSprites.push(this.ball.serialize());
        movingSprites = movingSprites.concat(this.fireballs.map(f => f.serialize()));
        movingSprites = movingSprites.concat(this.shells.map(s => s.serialize()));
        movingSprites = movingSprites.concat(this.saws.map(s => s.serialize()));
        if (this.lava) movingSprites.push(this.lava.serialize());

        sounds = sounds.filter((s, pos) => sounds.indexOf(s) == pos);

        const gameData = {
            "sprites": [
                this.players[0].serialize(), //Make sure the players stay in this order!
                this.players[1].serialize()
            ],
            "score": [this.players[0].serializeScore(), this.players[1].serializeScore()],
            "powerups": this.powerups.map(p => p.serialize()),
            "movingSprites": movingSprites,
            "sounds": sounds,
            "text": []
        };
        if (this.countingDown) gameData.text.push(this.countdownText.serialize());
        if (this.showingWinner) gameData.text.push(this.winnerText.serialize());

        return gameData;
    }

    score(scored) {
        if (scored[1] < WIDTH / 2) this.players[1].score++; //Increase score for whoever just scored
        else this.players[0].score++;

        const winner = this.winner();
        if (winner == -1) { //Someone scored but game isn't over
            this.countingDown = true; //Stop games from updating
            this.beginCountdown();
        } else { //Someone has won
            this.winnerText.text = `W${winner}`;
            this.showingWinner = true; //Stops game from updating
            this.fireballs.map(f => f.stopMoving());
            this.saws.map(s => s.stopMoving());
            this.shells.map(s => s.stopMoving());
            if (this.lava) this.lava.stopMoving();
            setTimeout(() => {
                this.endGame();
            }, 2500);
        }
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
            this.players[pIndex].shoot(); //Lets the player know they shot, for sound effects
        }
    }

    inp(pIndex, data) {
        switch (data.type) {
            case "pos":
                this.players[pIndex].setPos(data.data);
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
        this.game = new Game(a.playerName, b.playerName);
        this.joinRoom();
        console.log(`${a.id.substring(0,5)} and ${b.id.substring(0,5)} joined a room`);
    }

    update() {
        const gameData = this.game.update();
        if (this.game.gameHasEnded) {
            console.log(`${this.clientASocket.id.substring(0,5)} and ${this.clientBSocket.id.substring(0,5)} finished their game`);
            this.leaveRoom();
        }
        io.sockets.to(this.roomId).emit('gameData', gameData);
    }

    clientDisconnected(id) {
        io.sockets.to(this.roomId).emit('gotDisconnected');
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
            for (let s of clientsQueue) ids.push(s.id.substring(0, 5));

            console.log(`Queue: ${ids}`);
        }
        if (clientsQueue.length >= 2) {
            let room = new Room(clientsQueue[0], clientsQueue[1]);
            rooms.push(room);

            let ids = [];
            for (let s of clientsQueue) ids.push(s.id.substring(0, 5));
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

function sendPlayerCount(amt) {
    online += amt;
    io.sockets.emit('online', online);
}

io.sockets.on('connection', socket => {
    console.log(`New Client ${socket.id.substring(0,5)}`);
    sendPlayerCount(1);

    socket.on('addToQueue', name => {
        if (name.length < 1) name = "Player"; //Make sure name is right size
        if (name.length > 14) name = name.substring(0, 14);
        socket.playerName = name;
        addToQueue(socket);
    });

    socket.on('pos', pos => {
        const room = roomOf(socket);
        if (room != false) {
            const data = {
                type: 'pos',
                data: pos
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
            console.log(`${socket.id.substring(0,5)} disconnected from queue`);
        } else if (room != false) { //If they are in game
            room.clientDisconnected(socket.id); //end that game and kick out the other client
            console.log(`${socket.id.substring(0,5)} disconnected from a game`);
        } else {
            console.log(`${socket.id.substring(0,5)} disconnected from the menu`);
        }
        sendPlayerCount(-1);
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