let socket;
let status = "loading";

let sprites;
let joinButton;
let widthToHeight;
let cnv;
let origWidth = 640;
let origHeight = 360;
let scaleFactor = 1;
let marioOrYoshi;

const totalToLoad = 3;
let amtLoaded = 0;

let player;
let ball;
let justReceivedData = false;
let gameData = null;

let deltaTime = 0;
let lastFrameTime = Date.now();

function setup() {
    function loaded() {
        amtLoaded++;
        if (amtLoaded >= totalToLoad) { //Once assets have loaded, connect to the server
            status = "menu";
            joinButton.show();
            socket = io();
            socket.on('status', s => {
                status = s;
                if (status == "waiting") joinButton.hide();
                if (status == "menu") {
                    ball = null;
                    gameData = null;
                    joinButton.style("display", "inline");
                    sizeDOMCorrectly(); //Incase window resized in-game
                }
                console.log(status);
            });
            socket.on('gameData', d => {
                if (ball) {
                    ball.setPos(d.ball.x, d.ball.y);
                    ball.setVel(d.ball.vx, d.ball.vy);
                } else {
                    ball = new Ball(d.ball.width, d.ball.height, d.ball.x, d.ball.y, d.ball.vx, d.ball.vy);
                }
                justReceivedData = true;
                gameData = d;
            });
            socket.on('joined', data => {
                marioOrYoshi = data;
                const aOrB = (data == "Mario") ? 'A' : 'B';
                player = new Player(aOrB);
                status = "joined";
            });

            socket.on('disconnected', () => {
                console.log("DISCONNECT!!!!");
            });
        }
    }
    sprites = {
        'playerA': loadImage('sprites/playerA.png', loaded),
        'playerB': loadImage('sprites/playerB.png', loaded),
        'ball': loadImage('sprites/ball.png', loaded),
    }

    cnv = createCanvas(origWidth, origHeight);
    joinButton = select('#joinB');
    joinButton.mouseClicked(() => {
        socket.emit('addToQueue', true);
    });
    widthToHeight = width / height;
    joinButton.show(); //Show the button so it can get the correct height
    sizeDOMCorrectly(); //Size the dom
    joinButton.hide(); //Hide the join button until everything has loaded
}

function draw() {
    const now = Date.now();
    deltaTime = now - lastFrameTime;
    lastFrameTime = now;

    if (status == "joined") {
        player.update();
        renderGame();
    } else {
        render();
    }
}

function render() {
    fill(255);
    noStroke();
    textAlign(CENTER);
    if (status == "loading") {
        background(0);
        textSize(50 * scaleFactor);
        text("LOADING", width / 2, height * .3);
        noFill();
        stroke(255);
        strokeWeight(4);
        rect(width * .3, height / 2 - 20, width * .4, 40);
        noStroke();
        fill(255);
        const loadedWidth = map(amtLoaded, 0, totalToLoad, 0, width * .4);
        rect(width * .3, height / 2 - 20, loadedWidth, 40);
    } else if (status == "menu") {
        background(0);
        textSize(50 * scaleFactor);
        text("MENU", width / 2, height * .3);
    } else if (status == "waiting") {
        background(0);
        textSize(30 * scaleFactor);
        text("WAITING FOR ANOTHER PLAYER", width / 2, height * .3);
    }
}


function renderGame() {
    background(0);
    push();
    scale(scaleFactor);
    fill(255);
    try {
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(20);
        text(gameData.score[0], origWidth * .45, 25);
        text(gameData.score[1], origWidth * .55, 25);

        stroke(255);
        strokeWeight(3);
        const amtOfLines = 29;
        for (let i = 0; i < origHeight; i += (origHeight * 2 / amtOfLines)) {
            line(origWidth / 2, i, origWidth / 2, i + (origHeight / amtOfLines));
        }
        for (item of gameData.sprites) {
            if (item.name != player.name) image(sprites[item.name], item.x, item.y, item.width, item.height);
        }
        if (ball) {
            if (!justReceivedData) {
                ball.update();
            }
            justReceivedData = false;
            // console.log(ball);
            image(sprites["ball"], ball.pos.x, ball.pos.y, ball.width, ball.height);
        }

        noStroke();
        for (txt of gameData.text) {
            textSize(txt.size);
            const txtWidth = textWidth(txt.text);
            const txtHeight = txt.size;
            fill(0);
            rect(txt.x - txtWidth / 2, txt.y - txtHeight / 2, txtWidth, txtHeight);
            fill(255);

            if (txt.text == "START") txt.text = `${marioOrYoshi.toUpperCase()} START`;
            if (txt.text[0] = "W") { //If the text is saying the winner
                if (txt.text[1] == "M") { //If mario won
                    if (marioOrYoshi == "Mario") txt.text = "Congratulations\nMario Wins!";
                    else txt.text = "Game Over\nMario Wins";
                } else if (txt.text[1] == "Y") { //If yoshi won
                    if (marioOrYoshi == "Mario") txt.text = "Game Over\nYoshi Wins";
                    else txt.text = "Congratulations\nYoshi Wins!";
                }
            }
            text(txt.text, txt.x, txt.y);
        }
    } catch {
        console.log("No game data yet!");
    }

    if (player)
        image(sprites[player.name], player.pos.x, player.pos.y, player.displayWidth, player.displayHeight);
    pop();
    noFill();
    stroke(255);
    const weight = 2;
    strokeWeight(weight);
    rect(weight / 2, weight / 2, width - weight, height - weight);
}

function windowResized() {
    sizeDOMCorrectly();
}

function sizeDOMCorrectly() {
    let newWidth;
    let newHeight;
    if (windowWidth / windowHeight > widthToHeight) {
        newWidth = windowHeight * widthToHeight;
        newHeight = windowHeight;
    } else {
        newWidth = windowWidth;
        newHeight = windowWidth / widthToHeight;
    }


    resizeCanvas(newWidth, newHeight);
    cnv.position(windowWidth / 2 - width / 2, windowHeight / 2 - height / 2);
    joinButton.position((windowWidth / 2) - (joinButton.elt.clientWidth / 2),
        (windowHeight / 2) - (joinButton.elt.clientHeight / 2));

    scaleFactor = newWidth / origWidth;
    render();
}

window.onblur = () => {
    try {
        player.down = false;
        player.up = false;
    } catch {
        console.log("Socket not defined yet!");
    }
}

function keyPressed() {
    if (status == "joined" && player) {
        if (keyCode == 38 || keyCode == 87) { //Up arrow or W
            player.up = true;
        }
        if (keyCode == 40 || keyCode == 83) { //Down Arrow or S
            player.down = true;
        }
    }
}

function keyReleased() {
    if (status == "joined" && player) {
        if (keyCode == 38 || keyCode == 87) { //Up arrow or 
            player.up = false;
        }
        if (keyCode == 40 || keyCode == 83) { //Down Arrow or S
            player.down = false;
        }
    }
}

class Player {
    constructor(aOrB) {
        this.aOrB = aOrB;
        this.name = `player${this.aOrB}`;
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
            xPos = origWidth - this.width - 40;
        }
        this.pos = new Vector(xPos, origHeight / 2 - (this.height / 2)); //The x and y of the top right corner of the paddle
        this.prevY = undefined;
        this.up = false; //Is the up key pressed
        this.down = false; //Is the down key pressed
        this.speed = .4; //Vertical movement speed
    }

    reset() {
        this.pos.y = origHeight / 2 - (this.height / 2);
        this.up = false;
        this.down = false;
    }

    update() {
        if (this.up) this.pos.y -= (this.speed * deltaTime); //Move up
        if (this.down) this.pos.y += (this.speed * deltaTime); //Move down
        this.pos.y = Math.max(Math.min(origHeight - this.height, this.pos.y), 0); //Constrain vertical position
        if (this.pos.y != this.prevY) { //If the player has moved
            socket.emit('yPos', this.pos.y);
            this.prevY = this.pos.y;
        }
    }

}


class Ball {
    constructor(w, h, x, y, vx, vy) {
        this.width = w;
        this.height = h;
        this.pos = new Vector(x, y);
        this.vel = new Vector(vx, vy);
        this.speed = .3;
    }

    fixMag() {
        this.vel.setMag(this.speed);
    }

    update() {
        this.vel.setMag(deltaTime * this.speed);
        this.pos.add(this.vel);

        this.bounceWalls();
        this.pos.y = Math.max(Math.min(origHeight - this.height, this.pos.y), 0); //Constrain vertical position (can't go into floor

        if (this.vel.magSq() > 225) { //Make sure the ball never goes too fast (can't go above 15 speed)
            this.vel.setMag(15);
        }
        if (this.vel.x < .3 && this.vel.x > -.3) { //Make sure the ball never goes too vertical
            if (this.vel.x == 0) {
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

    setPos(x, y) {
        this.pos.x = x;
        this.pos.y = y;
    }

    setVel(x, y) {
        this.vel.x = x;
        this.vel.y = y;
    }

    bounceWalls() { //Bounce off floor and ceiling
        if ((this.pos.y <= 0 && this.vel.y < 0) || (this.pos.y >= origHeight - this.height && this.vel.y > 0)) {
            this.vel.y *= -1;
        }
    }
}

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