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
                if (status == "menu") joinButton.style("display", "inline");
                render();
                console.log(status);
            });
            socket.on('gameData', gameData => {
                renderGame(gameData);
            });
            socket.on('marioOrYoshi', data => {
                marioOrYoshi = data;
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

    render();
    noLoop();
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
        setTimeout(() => {
            render();
        }, (1000 / 60));
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

function dbg() { //TODO REMOVE THIS IN THE END!
    socket.emit('pauseToDebug');
}

function renderGame(gameData) {
    background(0);
    push();
    scale(scaleFactor);
    fill(255);
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
        image(sprites[item.name], item.x, item.y, item.width, item.height);
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

function keyPressed() {
    if (status == "joined") {
        if (keyCode == 38 || keyCode == 87) { //Up arrow or W
            socket.emit('up', true);
        }
        if (keyCode == 40 || keyCode == 83) { //Down Arrow or S
            socket.emit('down', true);
        }
    }
}

function keyReleased() {
    if (status == "joined") {
        if (keyCode == 38 || keyCode == 87) { //Up arrow or W
            socket.emit('up', false);
        }
        if (keyCode == 40 || keyCode == 83) { //Down Arrow or S
            socket.emit('down', false);
        }
    }
}