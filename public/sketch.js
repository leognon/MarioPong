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
    'playerACopter',
    'playerB',
    'playerBFire',
    'playerBCopter',
    'ball',
    'fireball',
    'shell',
    'saw',
    'lava',
    'copter',
    // 'copterHat',
    'fireflower',
    'big',
    'small',
    'star',
    'powerupBorder',
    'divider'
];
let lavaColor;

const totalToLoad = spriteNames.length + 1; //The + 1 is for loading the font
let amtLoaded = 0;
let font;

let player;
let movingSprites = [];
let justReceivedData = false;
let gameData = null;

let deltaTime = 0;
let lastFrameTime = Date.now();

function setup() {
    function loaded() {
        amtLoaded++;
        if (amtLoaded >= totalToLoad) { //Once assets have loaded, connect to the server
            lavaColor = color(255, 56, 4);
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
    font = loadFont("sprites/prstartk.otf", () => {
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
        const divider = sprites['divider'];
        image(divider, origWidth / 2 - divider.width / 2, 0, 2, origHeight); //Dotted line in center

        for (item of gameData.sprites) { //Shows players
            if (item.name != player.nameWithPowerup && item.powerup != "dead") {
                if (item.powerup == "Star") {
                    push();
                    const min = 0;
                    const max = 255;
                    const inc = (max - min) / 3;
                    const first = random(min + (inc * 2), max);
                    const second = random(min + (inc * 1), min + (inc * 2));
                    const third = random(min + (inc), min + (inc));
                    let rand = random(1);
                    if (rand < 1 / 3) tint(first, second, third); //Mostly Red
                    else if (rand < 2 / 3) tint(first, first, third); //Mostly yellow
                    else tint(second, second, first); //Mostly light Blue
                    image(sprites[item.name], item.x, item.y, item.width, item.height);
                    pop();
                } else {
                    image(sprites[item.name], item.x, item.y, item.width, item.height);
                }
            }
        }

        const margin = 10;
        for (powerup of gameData.powerups) { //Shows powerups
            const diameter = max(powerup.width, powerup.height);
            const centerX = powerup.x + (powerup.width / 2);
            const centerY = powerup.y + (powerup.height / 2);
            image(sprites['powerupBorder'], centerX - (diameter / 2) - margin, centerY - (diameter / 2) - margin, diameter + (margin * 2), diameter + (margin * 2)); //Border Image
            if (!powerup.collected) {
                let name;
                if (powerup.name == "Fire") name = "fireflower";
                if (powerup.name == "Big") name = "big";
                if (powerup.name == "Small") name = "small";
                if (powerup.name == "Copter") name = "copter";
                if (powerup.name == "Star") {
                    name = "star";
                    push();
                    const min = 0;
                    const max = 255;
                    const inc = (max - min) / 3;
                    const first = random(min + (inc * 2), max);
                    const second = random(min + (inc * 1), min + (inc * 2));
                    const third = random(min + (inc), min + (inc));
                    let rand = random(1);
                    if (rand < 1 / 3) tint(first, second, third); //Mostly Red
                    else if (rand < 2 / 3) tint(first, first, third); //Mostly yellow
                    else tint(second, second, first); //Mostly light Blue
                    image(sprites[name], powerup.x, powerup.y, powerup.width, powerup.height);
                    pop();
                } else {
                    image(sprites[name], powerup.x, powerup.y, powerup.width, powerup.height);
                }
            }
        }
        if (movingSprites.length > 0) { //Shows Ball, Fireballs, lava, shells, etc
            for (let movingSprite of movingSprites) {
                if (!justReceivedData) {
                    if (movingSprite.name == "lava") movingSprite.update(false);
                    else movingSprite.update();
                }
                movingSprite.show();
                if (movingSprite.name == "lava") {
                    for (let i = movingSprite.pos.x - movingSprite.width; i >= -movingSprite.width; i -= movingSprite.width) {
                        movingSprite.show(i);
                    }
                    for (let i = movingSprite.pos.x + movingSprite.width; i <= origWidth; i += movingSprite.width) {
                        movingSprite.show(i);
                    }
                    fill(lavaColor);
                    noStroke();
                    rect(0, movingSprite.pos.y + movingSprite.height - 3, origWidth, origHeight - movingSprite.pos.y + 10);
                }
            }
            justReceivedData = false;
        }

        noStroke();
        textAlign(CENTER, CENTER);
        fill(255);
        textSize(20);
        text(gameData.score[0], origWidth * .45, 25); //Shows scores
        text(gameData.score[1], origWidth * .55, 25);
    } else {
        console.log("No game data yet!");
    }

    if (player) player.show();

    if (gameData) {
        noStroke();
        fill(255);
        for (txt of gameData.text) { //Shows countdown, and winner
            textSize(txt.size);

            if (txt.text == "START") txt.text = `START`;
            if (txt.text[0] = "W") { //If the text is saying the winner
                if (txt.text[1] == "M") { //If mario won
                    if (marioOrYoshi == "Mario") txt.text = "Congratulations!\nMario Wins!";
                    else txt.text = "Game Over\nMario Wins";
                } else if (txt.text[1] == "Y") { //If yoshi won
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
    rect(weight / 2, weight / 2, width - weight, height - weight); //Border
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
            xPos = origWidth - (this.width + 50);
        }
        this.pos = new Vector(xPos, (origHeight / 2) - (this.height / 2)); //The x and y of the top right corner of the paddle
        this.prevPos = new Vector();
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
        if (this.powerup == "Copter" && p == null) {
            this.reset(); //Reset if it just had copter
        }

        if (p != this.powerup) {
            this.powerup = p;
            this.nameWithPowerup = this.name;
            if (this.powerup == "Fire") this.nameWithPowerup += "Fire";
            if (this.powerup == "Copter") this.nameWithPowerup += "Copter";
            else if (this.powerup == "dead") this.pos.y = (origHeight / 2) - (this.height / 2); //Reset pos if you die
            else if (this.powerup == "Big") {
                const margin = 50;
                const oldSizeMult = this.sizeMult;
                this.sizeMult = 1.3;

                this.width = this.baseWidth * this.sizeMult;
                this.height = this.baseHeight * this.sizeMult;
                this.displayWidth = this.baseDisplayWidth * this.sizeMult;
                this.displayHeight = this.baseDisplayHeight * this.sizeMult;

                if (this.aOrB == 'A') {
                    this.pos.x = margin - (this.baseWidth / this.sizeMult);
                } else if (this.aOrB == 'B') {
                    this.pos.x = origWidth - (margin + (this.baseWidth * this.sizeMult));
                }
                this.pos.y -= (this.sizeMult - oldSizeMult) * this.baseHeight * .5;
            } else if (this.powerup == "Small") {
                const oldSizeMult = this.sizeMult;
                const margin = 50;
                this.sizeMult = .8;
                this.width = this.baseWidth * this.sizeMult;
                this.height = this.baseHeight * this.sizeMult;
                this.displayWidth = this.baseDisplayWidth * this.sizeMult;
                this.displayHeight = this.baseDisplayHeight * this.sizeMult;
                if (this.aOrB == 'A') {
                    this.pos.x = margin - (this.baseWidth / this.sizeMult);
                } else if (this.aOrB == 'B') {
                    this.pos.x = origWidth - (margin + (this.baseWidth * this.sizeMult));
                }
                this.pos.y -= (this.sizeMult - oldSizeMult) * this.baseHeight * .5;
            }
            if (this.powerup != "Big" && this.powerup != "Small") {
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
                    this.pos.x = origWidth - (margin + this.baseWidth);
                }
                this.pos.y -= (this.sizeMult - oldSizeMult) * this.baseHeight * .5;
            }
        }
    }

    show() {
        //Accounts for different transparency in each sprite
        if (this.powerup == "dead") return;
        if (this.powerup == "Star") {
            push();
            const min = 0;
            const max = 255;
            const inc = (max - min) / 3;
            const first = random(min + (inc * 2), max);
            const second = random(min + (inc * 1), min + (inc * 2));
            const third = random(min + (inc), min + (inc));
            let rand = random(1);
            if (rand < 1 / 3) tint(first, second, third); //Mostly Red
            else if (rand < 2 / 3) tint(first, first, third); //Mostly yellow
            else tint(second, second, first); //Mostly light Blue
        }
        if (this.aOrB == 'A')
            image(sprites[this.nameWithPowerup], this.pos.x + (this.displayWidth / 6), this.pos.y, this.displayWidth, this.displayHeight);
        else if (this.aOrB == 'B')
            image(sprites[this.nameWithPowerup], this.pos.x - (this.displayWidth * .25), this.pos.y, this.displayWidth, this.displayHeight);
        if (this.powerup == "Star") pop();
    }

    reset() {
        this.pos.y = origHeight / 2 - (this.height / 2);
        this.up = false;
        this.down = false;
    }

    update() {
        if (this.powerup != "dead" && this.powerup != "Copter") {
            if (this.up) this.pos.y -= (this.speed * deltaTime / this.sizeMult); //Move up
            if (this.down) this.pos.y += (this.speed * deltaTime / this.sizeMult); //Move down
            this.pos.y = Math.max(Math.min(origHeight - this.height, this.pos.y), 0); //Constrain vertical position

        }
        if (this.powerup == "Copter") {
            this.pos.y = lerp(this.pos.y, -75, .05);
        }
        if (this.pos.x != this.prevPos.x || this.pos.y != this.prevPos.y) { //If the player has moved, send position to server
            const data = {
                'x': this.pos.x,
                'y': this.pos.y
            }
            socket.emit('pos', data);
            this.prevPos = this.pos.copy();
            this.sentNotMoving = false;
        } else if (!this.sentNotMoving) {
            const data = {
                'x': this.pos.x,
                'y': this.pos.y
            }
            socket.emit('pos', data); //When we stop moving, emit the pos one more time so the server knows
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

    show(x = this.pos.x) {
        if (this.name == "fireball" || this.name == "saw") {
            push();
            translate(this.pos.x + this.width / 2, this.pos.y + this.height / 2);
            rotate(this.extra.rot);
            image(sprites[this.name], -this.width / 2, -this.height / 2, this.width, this.height);
            pop();
        } else {
            image(sprites[this.name], x, this.pos.y, this.width, this.height);
        }
    }

    fixMag() {
        this.vel.setMag(this.speed);
    }

    update(shouldBounce = true) {
        this.vel.setMag(deltaTime * this.speed);
        this.pos.add(this.vel);

        if (shouldBounce) {
            this.bounceWalls();
            this.pos.y = Math.max(Math.min(origHeight - this.height, this.pos.y), 0); //Constrain vertical position (can't go into floor
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
        if (currMagSq > 0 && m * m != currMagSq) {
            const currMag = Math.sqrt(currMagSq);
            this.x = (this.x / currMag) * m;
            this.y = (this.y / currMag) * m;
        }
    }
}