new p5(() => {
    let socket;
    let status = "loading";
    let initialConnect = false;

    let sprites;
    let sounds;
    let muted = false;

    let joinDiv;
    let joinButton;
    let playerNameInp;
    let creditsDiv;

    let widthToHeight;
    let cnv;
    let origWidth = 640;
    let origHeight = 360;
    let scaleFactor = 1;

    let marioOrYoshi;
    let online;


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
        'fireflower',
        'big',
        'small',
        'star',
        'powerupBorder',
        'divider'
    ];
    const soundNames = [
        "hit",
        "die",
        "collect",
        "bounce",
        "shoot"
    ]
    let lavaColor;

    const totalToLoad = spriteNames.length + soundNames.length + 1; //The + 1 is for loading the font
    let amtLoaded = 0;
    let font;

    let player;
    let movingSprites = [];
    let justReceivedData = false;
    let gameData = null;

    let message;
    let showMessage = false;

    let deltaTime = 0;
    let lastFrameTime = Date.now();

    let pressing = false;
    //Credit to https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
    window.isMobile = function() {
        let check = false;
        (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
        return check;
    };

    setup = () => {
        if (!window.location.hostname.match('leognon') && !window.location.hostname.match('localhost')) {
            if (confirm('Mario Pong will soon be moved to a new URL.'
                + '\nPlease migrate to \'https://mario-pong.leognon.com\''
                + '\nWould you like to go there now?')) {
                window.location.href = 'https://mario-pong.leognon.com'
            }
        }
        if (isMobile()) {
            alert('Mario Pong works best on a computer. If you cannot use a computer, try using the Google web browser. Be sure you zoom out fully, and refresh the page to reset the elements positioning.');
            document.getElementsByClassName('creditsRight')[1].innerText = 'Drag to move your character';
            document.getElementsByClassName('creditsRight')[2].innerText = 'Fireballs will shoot automatically';
            document.getElementsByClassName('creditsRight')[3].innerText = 'Mario Pong works best on a computer!';
        }
        function loaded() {
            amtLoaded++;
            if (amtLoaded >= totalToLoad) { //Once assets have loaded, connect to the server
                lavaColor = color(255, 56, 4);
                status = "menu";
                joinDiv.show()
                creditsDiv.show();

                socket = io({
                    'reconnection': false
                }); //Connect the client, and don't reconnect if disconnected
                socket.on('status', s => {
                    status = s;
                    if (status == "waiting") {
                        joinDiv.hide();
                        creditsDiv.hide();
                    }
                    if (status == "menu") {
                        movingSprites = [];
                        gameData = null;
                        joinDiv.style("display", "inline");
                        creditsDiv.style("display", "inline");
                        sizeDOMCorrectly(); //Incase window resized in-game
                    }
                });
                socket.on('gameData', d => {
                    movingSprites = [];
                    for (let i = 0; i < d.movingSprites.length; i++) {
                        movingSprite = d.movingSprites[i];
                        movingSprites.push(
                            new MovingSprite(movingSprite.name, movingSprite.width, movingSprite.height, movingSprite.x,
                                movingSprite.y, movingSprite.vx, movingSprite.vy, movingSprite.speed, movingSprite.extra));
                    }
                    if (!muted) {
                        for (let i = 0; i < d.sounds.length; i++) {
                            sounds[d.sounds[i]].play(); //Play sound effects for that frame
                        }
                    }
                    justReceivedData = true;
                    const index = (player.aOrB == 'A') ? 0 : 1;

                    player.setPowerup(d.sprites[index].powerup);

                    gameData = d;
                });
                socket.on('joined', data => {
                    marioOrYoshi = data;
                    const aOrB = (data == "Mario") ? 'A' : 'B';
                    player = new Player(aOrB);
                    status = "joined";
                });
                socket.on('gotDisconnected', () => {
                    message = "Your opponent\nhas disconnected.";
                    showMessage = true;
                    setTimeout(() => {
                        showMessage = false; //Show the msg for 3 seconds
                    }, 3000);
                });
                socket.on('online', amt => {
                    online = amt;
                });
            }
        }
        masterVolume(.3);
        sprites = {};
        sounds = {};
        for (name of spriteNames) sprites[name] = loadImage(`sprites/${name}.png`, loaded); //Load all of the sprites
        for (name of soundNames) sounds[name] = loadSound(`sounds/${name}.wav`, loaded); //Load all of the sounds
        font = loadFont("sprites/prstartk.otf", () => {
            textFont(font);
            loaded();
        });

        cnv = createCanvas(origWidth, origHeight);
        joinDiv = select('#joinDiv');

        let pName = "Player";
        for (let i = 0; i < 4; i++) pName += floor(random(10));

        if (localStorage.getItem("MarioPongUsername") != null) pName = localStorage.getItem("MarioPongUsername");

        playerNameInp = select('#playerName').value(pName);
        playerNameInp.changed(() => {
            if (playerNameInp.value().length < 1) playerNameInp.value(pName);
            localStorage.setItem("MarioPongUsername", playerNameInp.value());
        });
        playerNameInp.touchStarted(() => {
            if (playerNameInp.value().length < 1) playerNameInp.value(pName);
            localStorage.setItem("MarioPongUsername", playerNameInp.value());
        });

        playerNameInp.mouseClicked(() => {
            document.getElementById('playerName').select();
        });
        playerNameInp.touchStarted(() => {
            document.getElementById('playerName').select();
        });

        creditsDiv = select('#creditsDiv');

        joinButton = select('#joinB');
        joinButton.mouseClicked(() => {
            socket.emit('addToQueue', playerNameInp.value()); //Join the queue with the player name
        });
        joinButton.touchStarted(() => {
            socket.emit('addToQueue', playerNameInp.value()); //Join the queue with the player name
        });
        widthToHeight = width / height;
        joinDiv.show(); //Show the button so it can get the correct height
        sizeDOMCorrectly(); //Size the dom
        joinDiv.hide(); //Hide the join button until everything has loaded
    }

    draw = () => {
        if (status == "joined" && player && isMobile()) {
            const correctMouse = mouseY / scaleFactor;
            const correctPlayer = player.pos.y + (player.displayHeight/2);
            if (pressing && abs(correctMouse - correctPlayer) > 3) {
                if (correctMouse < correctPlayer) {
                    player.up = true;
                    player.down = false;
                } else {
                    player.down = true;
                    player.up = false;
                }
            } else {
                player.up = false;
                player.down = false;
            }

            if (player.powerup == "Fire" && random(1) < 0.01) player.shoot();
        }
        if (!initialConnect && socket && socket.connected) initialConnect = true;
        if (initialConnect && socket.disconnected) { //If Disconnected, show it and freeze the game
            refreshMsg = "You have been disconnected from the server!\nPlease refresh the page!";
            alert("You have been disconnected from the server! Please refresh the page!");
            noLoop(); //Make sure game is stopped
            location.reload(true); //Force reload the page and the cache
            noStroke();
            textSize(15 * scaleFactor);
            textAlign(CENTER);
            const w = textWidth(refreshMsg) * .6;
            fill(0);
            rect(width / 2 - (w / 2), (height * .15) - (25 * scaleFactor), w, 65 * scaleFactor);
            fill(255, 0, 0);
            text(refreshMsg, width / 2, height * .15);
        } else {
            const now = Date.now();
            deltaTime = now - lastFrameTime;
            lastFrameTime = now;

            if (status == "joined") {
                player.update();
                renderGame();
            } else {
                render();
            }
            if (showMessage) {
                noStroke();
                textSize(25 * scaleFactor);
                textAlign(CENTER);
                const w = textWidth(message) * .6;
                fill(0);
                rect(width / 2 - (w / 2), (height * .15) - (25 * scaleFactor), w, 65 * scaleFactor);
                fill(255, 0, 0);
                text(message, width / 2, height * .15);
            }
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
            text("MARIO\nPONG", width / 2 + 3, height * .15);
        } else if (status == "waiting") {
            background(0);
            textSize(30 * scaleFactor);
            text("WAITING FOR\nANOTHER PLAYER", width / 2, height * .15);
        }
        if (status == "menu" || status == "waiting") {
            push();
            scale(scaleFactor); //This all just draws the menu
            const divider = sprites["divider"];
            image(divider, origWidth / 2 - divider.width / 2, 0, 2, origHeight); //Dotted line in center
            image(sprites["ball"], 90, 140, 8, 8);
            image(sprites["fireball"], 490, 220, 40, 40);
            push();
            translate(221, 309);
            rotate(PI / 2);
            image(sprites["fireball"], -20, -20, 40, 40);
            pop();
            const margin = 10;
            const diameter = 41.6;
            const centerX = 320;
            const centerY = 200;
            image(sprites['powerupBorder'], centerX - (diameter / 2) - margin, centerY - (diameter / 2) - margin, diameter + (margin * 2), diameter + (margin * 2)); //Border Image
            image(sprites['playerAFire'], 54, 56, 24, 50);
            image(sprites['playerB'], 561, 69, 34.3, 50);
            pop();
            textSize(10 * scaleFactor);
            if (online != undefined) {
                let txt = " players\nonline!";
                if (online == 1) txt = " player\nonline!";
                text(online + txt, width - (60 * scaleFactor), 30);
            }
        }
    }


    function renderGame() {
        background(0);
        push();
        scale(scaleFactor);
        fill(255);
        const divider = sprites['divider'];
        image(divider, origWidth / 2 - divider.width / 2, 0, 2, origHeight); //Dotted line in center
        if (gameData) {
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
        }
        if (player) player.show();

        if (gameData) {
            const margin = 10;
            for (powerup of gameData.powerups) { //Shows powerups
                const diameter = max(powerup.width, powerup.height);
                const centerX = powerup.x + (powerup.width / 2);
                const centerY = powerup.y + (powerup.height / 2);
                image(sprites['powerupBorder'], centerX - (diameter / 2) - margin, centerY - (diameter / 2) - margin, diameter + (margin * 2), diameter + (margin * 2)); //Border Image
                if (powerup.shown) {
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
            fill(255);
            textSize(15);
            textAlign(RIGHT);
            text(`${gameData.score[0].name} ${gameData.score[0].score}`, origWidth * .48, 20);
            textAlign(LEFT);
            text(`${gameData.score[1].score} ${gameData.score[1].name}`, origWidth * .52, 20);
        } else {
            console.log("No game data yet!");
        }


        if (gameData) {
            textAlign(CENTER, CENTER);
            noStroke();
            fill(255);
            for (txt of gameData.text) { //Shows countdown, and winner
                textSize(txt.size);

                if (txt.text == "START") txt.text = `START`;
                if (txt.text[0] = "W") { //If the text is saying the winner
                    if (txt.text[1] == "M") { //If mario won
                        if (marioOrYoshi == "Mario") txt.text = `Congratulations!\n${gameData.score[0].name} Wins!`;
                        else txt.text = `Game Over\n${gameData.score[0].name} Wins`;
                    } else if (txt.text[1] == "Y") { //If yoshi won
                        if (marioOrYoshi == "Mario") txt.text = `Game Over\n${gameData.score[1].name} Wins`;
                        else txt.text = `Congratulations!\n${gameData.score[1].name} Wins!`;
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

    windowResized = () => {
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

        scaleFactor = newWidth / origWidth;
        render();
    }

    window.onblur = () => {
        if (player) {
            player.down = false;
            player.up = false;
        }
    }

    //Mobile controls
    window.ontouchstart = () => {
        pressing = true;
    }
    window.ontouchend = () => {
        pressing = false;
    }

    window.onkeydown = k => {
        if (status == "joined" && player) {
            if (k.keyCode == 38 || k.keyCode == 87) { //Up arrow or W
                player.up = true;
            }
            if (k.keyCode == 40 || k.keyCode == 83) { //Down Arrow or S
                player.down = true;
            }
            if (k.keyCode == 32) { //Space
                player.shoot();
            }
        }
        if (k.keyCode == 77 && document.activeElement.id != "playerName") {
            muted = !muted; //Press M to mute/unmute
        }
    }

    window.onkeyup = k => {
        if (status == "joined" && player) {
            if (k.keyCode == 38 || k.keyCode == 87) { //Up arrow or 
                player.up = false;
            }
            if (k.keyCode == 40 || k.keyCode == 83) { //Down Arrow or S
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
                this.pos.y = lerp(this.pos.y, -75, .0035 * deltaTime);
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
});
