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

const spriteNames = [
    'playerA',
    'playerAFire',
    'playerB',
    'playerBFire',
    'ball',
    'fireball',
    'fireflower',
    'powerupBorder',
    'divider'
];

const totalToLoad = spriteNames.length + 1; //The + 1 is for loading the font
let amtLoaded = 0;
let font;

let player;
let movingSprites = [];
let justReceivedData = false;
let gameData = null;

let deltaTime = 0;
let lastFrameTime = Date.now();
//TODO Fix glitch where fireballs try to move during countdown
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
                    movingSprites = [];
                    gameData = null;
                    joinButton.style("display", "inline");
                    sizeDOMCorrectly(); //Incase window resized in-game
                }
                console.log(status);
            });
            socket.on('gameData', d => {
                movingSprites = [];
                for (let i = 0; i < d.movingSprites.length; i++) {
                    movingSprite = d.movingSprites[i];
                    movingSprites.push(
                        new MovingSprite(movingSprite.name, movingSprite.width, movingSprite.height, movingSprite.x,
                            movingSprite.y, movingSprite.vx, movingSprite.vy, movingSprite.speed, movingSprite.extra));
                }
                justReceivedData = true;
                const index = (player.aOrB == 'A') ? 0 : 1;

                player.setPowerup(d.sprites[index].powerup);

                gameData = d;
            });
            socket.on('joined', data => {
                console.log("joined");
                marioOrYoshi = data;
                const aOrB = (data == "Mario") ? 'A' : 'B';
                player = new Player(aOrB);
                status = "joined";
            });
        }
    }

    sprites = {};
    for (name of spriteNames) {
        sprites[name] = loadImage(`sprites/${name}.png`, loaded); //Load all of the sprites
    }
    font = loadFont("sprites/prstartk.TTF", () => {
        textFont(font);
        loaded();
    });

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
        textSize(7 * scaleFactor);
        textAlign(LEFT);
        text("Font:\"Press Start K\" by codeman38", 10, height - 10);
    } else if (status == "waiting") {
        background(0);
        textSize(30 * scaleFactor);
        text("WAITING FOR\nANOTHER PLAYER", width / 2, height * .3);
    }
}


function renderGame() {
    background(0);
    push();
    scale(scaleFactor);
    fill(255);
    if (gameData) {
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(20);
        text(gameData.score[0], origWidth * .45, 25);
        text(gameData.score[1], origWidth * .55, 25);

        const divider = sprites['divider'];
        image(divider, origWidth / 2 - divider.width / 2, 0, 2, origHeight);

        for (item of gameData.sprites) {
            if (item.name != player.nameWithPowerup && item.powerup != "dead") {
                image(sprites[item.name], item.x, item.y, item.width, item.height);
            }
        }

        const margin = 10;
        for (powerup of gameData.powerups) {
            const diameter = max(powerup.width, powerup.height) + (margin * 2);
            image(sprites['powerupBorder'], powerup.x - margin, powerup.y - margin, diameter, diameter); //Border Image
            if (!powerup.collected) {
                let name;
                if (powerup.name == "Fire") name = "fireflower";
                image(sprites[name], powerup.x, powerup.y, powerup.width, powerup.height);
            }
        }
        if (movingSprites.length > 0) {
            for (let movingSprite of movingSprites) {
                if (!justReceivedData) {
                    movingSprite.update();
                }
                movingSprite.show();
            }
            justReceivedData = false;
        }

    } else {
        console.log("No game data yet!");
    }

    if (player) player.show();

    if (gameData) {
        noStroke();
        fill(255);
        for (txt of gameData.text) {
            textSize(txt.size);

            if (txt.text == "START") txt.text = `START`;
            if (txt.text[0] = "W") { //If the text is saying the winner
                if (txt.text[1] == "M") { //If mario won
                    textSize(40);
                    if (marioOrYoshi == "Mario") txt.text = "Congratulations!\nMario Wins!";
                    else txt.text = "Game Over\nMario Wins"; //TODO Text is not completely centered with the \n
                } else if (txt.text[1] == "Y") { //If yoshi won
                    textSize(40);
                    if (marioOrYoshi == "Mario") txt.text = "Game Over\nYoshi Wins";
                    else txt.text = "Congratulations!\nYoshi Wins!";
                }
            }
            text(txt.text, txt.x, txt.y);
        }
    }
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
        if (keyCode == 32) { //Space
            player.shoot();
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
        this.nameWithPowerup = this.name;
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
            xPos = origWidth - this.width - 40;
        }
        this.pos = new Vector(xPos, (origHeight / 2) - (this.height / 2)); //The x and y of the top right corner of the paddle
        this.prevY = undefined;
        this.up = false; //Is the up key pressed
        this.down = false; //Is the down key pressed
        this.speed = .4; //Vertical movement speed
        this.sentNotMoving = true;
    }

    shoot() {
        if (this.powerup == "Fire") {
            socket.emit('shoot');
        }
    }

    setPowerup(p) {
        this.powerup = p;
        this.nameWithPowerup = this.name;
        if (this.powerup == "Fire") this.nameWithPowerup += "Fire";
    }

    show() {
        //Accounts for different transparency in each sprite
        if (this.powerup == "dead") return;
        if (this.aOrB == 'A') image(sprites[this.nameWithPowerup], this.pos.x + 3, this.pos.y, this.displayWidth, this.displayHeight);
        else if (this.aOrB == 'B') image(sprites[this.nameWithPowerup], this.pos.x - 7, this.pos.y, this.displayWidth, this.displayHeight);
    }

    reset() {
        this.pos.y = origHeight / 2 - (this.height / 2);
        this.up = false;
        this.down = false;
    }

    update() {
        if (this.powerup != "dead") {
            if (this.up) this.pos.y -= (this.speed * deltaTime); //Move up
            if (this.down) this.pos.y += (this.speed * deltaTime); //Move down
            this.pos.y = Math.max(Math.min(origHeight - this.height, this.pos.y), 0); //Constrain vertical position
        }
        if (this.pos.y != this.prevY) { //If the player has moved, send position to server
            socket.emit('yPos', this.pos.y);
            this.prevY = this.pos.y;
            this.sentNotMoving = false;
        } else if (!this.sentNotMoving) {
            socket.emit('yPos', this.pos.y); //When we stop moving, emit the pos one more time so the server knows
            this.sentNotMoving = true;
        }
    }

}


class MovingSprite {
    constructor(name, w, h, x, y, vx, vy, s, extra) {
        this.name = name;
        this.width = w;
        this.height = h;
        this.pos = new Vector(x, y);
        this.vel = new Vector(vx, vy);
        this.speed = s;
        this.extra = extra;
    }

    show() {
        if (this.name == "fireball") {
            push();
            translate(this.pos.x + this.width / 2, this.pos.y + this.height / 2);
            rotate(Math.PI * this.extra.rot * .5);
            image(sprites[this.name], -this.width / 2, -this.height / 2, this.width, this.height);
            pop();
        } else {
            image(sprites[this.name], this.pos.x, this.pos.y, this.width, this.height);
        }
    }

    fixMag() {
        this.vel.setMag(this.speed);
    }

    update() {
        this.vel.setMag(deltaTime * this.speed);
        this.pos.add(this.vel);

        this.bounceWalls();
        this.pos.y = Math.max(Math.min(origHeight - this.height, this.pos.y), 0); //Constrain vertical position (can't go into floor
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

    mag() {
        return Math.sqrt((this.x * this.x) + (this.y * this.y));
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