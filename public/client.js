//variables defined on set up
let players = {}
let lobbies = {}
let buttons = []
let texts = []
let thisMap
let number = 0
let cellSize
let mapSize = 6
let connected = false
let myMessage = false
let correction = 0
let connectionCheck = false
let menuUp = false
let healthBarXOffSet 
let healthBarYOffSet
let playerSpacing
let winScreen = false
let tempPlayers
let winArea
let ligths //2nd canvas for lights


let playerID = localStorage.getItem("playerID")
let userName = localStorage.getItem("userName")

if(!playerID){
    playerID = crypto.randomUUID()
    localStorage.setItem("playerID", playerID)
}
if(!userName){userName = undefined}

//objects
class myButton {
    constructor(x,y,w,h, text, colour, tSize, tAlign,funct, para){
        this.x = x
        this.y = y
        this.w = w
        this.h = h
        this.text = text
        this.tSize = tSize
        this.tAlign = tAlign
        this.r = colour[0]
        this.g = colour[1]
        this.b = colour[2]
        this.funct = funct
        this.para = para
    }
    check(x,y){
        if(
            x >= this.x &&
            x <= this.x + this.w &&
            y >= this.y &&
            y <= this.y + this.h 
        ) {
            this.funct(this.para)
        }
    }
    draw(x,y){
        strokeWeight(0)
        textAlign(this.tAlign,CENTER)
        if(this.tAlign === CENTER){
            correction = this.w/2
        } else if(this.tAlign === RIGHT){
            correction = this.w
        } else {
            correction = 0
        }

        if(this.tSize === "fill"){
            textSize(this.w * 2 /this.text.length)
        } else {
            textSize(this.tSize)
        }
         
        if(
            x >= this.x &&
            x <= this.x + this.w &&
            y >= this.y &&
            y <= this.y + this.h 
        ) {
            fill(this.r,this.g,this.b, 180)
            rect(this.x,this.y,this.w,this.h)
            fill("black")
            text(this.text, this.x + correction,this.y + this.h/2)
            
        } else {
            fill(this.r,this.g,this.b)
            text(this.text, this.x + correction,this.y + this.h/2)
        }     
    }
}
class textBox {
    constructor(x,y,size,align,colour,content){
        this.x = x
        this.y = y
        this.size = size
        this.align = align
        this.r = colour[0]
        this.g = colour[1]
        this.b = colour[2]
        this.content = content
    }
    draw() {
        fill(this.r,this.g,this.b)
        textSize(this.size)
        textAlign(this.align,CENTER)
        strokeWeight(0)
        text(this.content, this.x,this.y)
    }
}

async function setup() {
    createCanvas(windowWidth,windowHeight)
    cellSize = floor(min(width / (mapSize + 2), height / (mapSize + 2)))
    healthBarXOffSet = 0.1 * cellSize
    healthBarYOffSet = 0.1 * cellSize
    playerSpacing = width/20
    
    lights = createGraphics(width,height)

    angleMode(DEGREES)

    let inSession = localStorage.getItem("inSession")


    if(inSession === 'true'){
        serverConnection()
    } else {
        buttons.push(new myButton(width/2 - cellSize * 1.5,3*cellSize,3*cellSize,1*cellSize,"> Start",[255,0,0],cellSize * 0.5,LEFT,serverConnection))
    }

    textFont("Courier New")
    textWrap(WORD)
}


//Functions which will be used in all game states 
function serverConnection(){
    if(userName){
        if(userName.length >= 30){ myAlert("Usernames have a maximum of 30 characters") } else {
            localStorage.setItem("userName", userName)
            socket = io({
                auth:{playerID: playerID,userName: userName}
            })

            connectionCheck = setTimeout(() => {
                window.location.reload()
            },2000)
            
            socket.on("heartBeat", () => {
                if(connectionCheck) {
                    clearTimeout(connectionCheck)
                }   
                connectionCheck = setTimeout(() => {
                window.location.reload()
                },2000)
            })

            buttons = []

            //data from server
            socket.on("preLobbyUpdate", (playerData,lobbyData) => {
                console.log(playerData)
                if(!winScreen)
                if(playerData[playerID]){
                    if(playerData[playerID].group === "preLobby"){
                        players = playerData
                        lobbies = lobbyData
                        refreshLobbies()
                    }
                }
            }) 
            socket.on("lobbyUpdate", (thisLobby) => {
                players = thisLobby.players
                lobby = thisLobby
                refreshLobby()
            })
            socket.on("gameSessionUpdate", (mapData,playerData,itemData,leverData,winAreaData, enemyData) => {
                players = playerData
                thisMap = mapData
                items = itemData
                levers = leverData
                winArea = winAreaData
                enemies = enemyData
            })
            socket.on("gameSessionRefresh", () => {
                refreshSession()
                console.log("session")
            })

            socket.on("playerAlert", (data) => {
                myAlert(data)
            })
            socket.on("kicked", () => {
                myAlert("You were kicked from the lobby")
                localStorage.setItem("inSession", false)
            })
            socket.on("closeTab", () => {
                alert("You can no longer use this window")
                window.close()
            })
            socket.on("WIN" ,(playerData) => { 
                players = playerData
                tempPlayers = Object.values(playerData)
                console.log("win")
                winScreen = true

                buttons.push(new myButton(0, 0.75 * height, width, cellSize, "Leave", [255,0,0] ,cellSize,LEFT, leaveWinScreen))
                texts.push(new textBox(width / 2, height * 0.6, height * 0.1,CENTER,[255,0,0],"You Won"))
            })

            localStorage.setItem("inSession", false)
            connected = true
        }   
    } else {
        myAlert("Enter a username")
    }
}
function myAlert(m){
    myMessage = m
    setTimeout(()=>{
        myMessage = false
    },800)
}

document.addEventListener("keydown", (a) => {
    if(players[playerID]){
        if(a.key === "m" && players[playerID].group === "gameSession"){
            menu()
        } else if(a.keyCode >= 32 || a.keyCode === 16){
            socket.emit("keyDown", a.keyCode)
        } 

    } else {
        if(a.keyCode >= 32){
            if(userName){
                userName = userName + a.key
            } else {
                userName = a.key
            }
        } else if (a.key === "Backspace" && userName){
            userName = userName.slice(0,-1)
        }
        
    }
})
document.addEventListener("keyup", (a) => {
    if(players[playerID] && (a.keyCode >= 32 || a.keyCode === 16)){
        socket.emit("keyUp", a.keyCode)
    }
})
function mouseClicked() {
    for(let i = 0; i <= buttons.length; i++){
        if(buttons[i]){
        buttons[i].check(mouseX,mouseY)
        }
    }
}

//drawing
function draw(){
    if(winScreen){
        drawWinScreen() 
        console.log("test")
    } else if(players[playerID]){
        switch(players[playerID].group){
            case "preLobby":
                //draw prelobby
                drawPreLobby()
                break;
            case "lobby":
                //draw lobby
                drawLobby()
                break;
            case "gameSession":
                drawGameSession()
                //draw game session
                break;
        }
    }   else if(!connected){
        background(50)
        strokeWeight(cellSize * 0.005)
        textSize(cellSize * 0.2 * 0.8)
        textAlign(LEFT,CENTER)
        noFill()
        stroke("red")
        rect(width/2 - cellSize * 2.5, 2.7*cellSize, 5*cellSize, 0.2*cellSize)
        fill("red")
        if(userName){
            text("Username> " + userName + " <",width/2 - cellSize * 2.5,2.8 *cellSize)
        } else {
            text("Username>  <",width/2 - cellSize * 2.5,2.8 * cellSize)
        }
    }
    for(let i = 0; i < buttons.length; i++){
        buttons[i].draw(mouseX,mouseY)
    }
    for(let i = 0; i < texts.length; i++){
        texts[i].draw()
    }
    if(myMessage){
        strokeWeight(0)
        fill(0,0,0,200)
        rect(0,0,width,height)
        textSize(cellSize * 20/myMessage.length)
        textAlign(CENTER,CENTER)
        fill("red")
        text(myMessage, width * 0.1, height/2, width * 0.8)
    }
}


function drawPreLobby(){
    background(50)
    fill("blue")
    textAlign(CENTER)
    textSize(cellSize * 0.5)
    stroke("black")
    strokeWeight(cellSize * 0.005)
}
function createLobby(){
    if(players[playerID].group === "preLobby"){
        socket.emit("createLobby")
    }
}
function joinLobby(lobbyID) {
    if(players[playerID].group === "preLobby"){
        socket.emit("joinLobby", lobbyID)
    }
}
function refreshLobbies(){
    buttons = []
    texts = []
    buttons.push(new myButton(0, 0, width, 1 * cellSize,"> Create lobby",[255,0,0],cellSize * 0.4,LEFT, createLobby))
    k = 0
    j = 0
    for(let id in lobbies){
        let i = lobbies[id]
        if(j + 1.5 >= mapSize){ k++; j = 0}
        if(i.priority.length <= 4){
            let lobbyText = "> " + players[i.priority[0]].userName + "'s lobby | players: " + i.priority.length + "/4"

            buttons.push(new myButton((k * 6) *cellSize, (j + 1.5) * cellSize, 5 * cellSize, 0.8 * cellSize, lobbyText , [255,0,0], cellSize * 0.3 ,LEFT, joinLobby, id))

            j++
        }
    }
    console.log("pre lobby")
}


function drawLobby(){
    fill("red")
    background(50)
    for(let i = 0; i < 4; i++){
        noFill()
        stroke("red")
        strokeWeight(playerSpacing / 2)
        square(i * width/4 + playerSpacing, height/2 - width/4 + playerSpacing, width/4 - playerSpacing * 2)
        strokeWeight(cellSize * 0.01)
        stroke("black")
        fill("black")
        textSize(cellSize * 0.3)
        textAlign(CENTER,CENTER)
        if(i < lobby.priority.length){
            text(players[lobby.priority[i]].userName, i * width/4 + width/8, height/2 - width/8)
        }
    }
}
function refreshLobby(){
    localStorage.setItem("inSession", true)
    buttons = []
    texts = []
    buttons.push(new myButton(0, height - cellSize * 2, width, cellSize, "> Leave", [255,0,0], cellSize / 2, LEFT, leave))
    if(playerID === lobby.priority[0]){
        buttons.push(new myButton(0, height - cellSize * 3, width,cellSize,"> Start",[255,0,0], cellSize/2,LEFT, startGameSession))
        for(let i = 1; i < lobby.priority.length; i ++){
            buttons.push(new myButton(i * width/4 + width/20, height/2 - width/32, width/4 - width/10, cellSize/2,"> Kick",[255,0,0],cellSize/3,CENTER,kick, lobby.priority[i]))
        }
    }
    console.log("lobby")
}
function startGameSession(){
    socket.emit("startGameSession")
}
function leave(){
    socket.emit("leaveLobby")
    localStorage.setItem("inSession", false)
}
function kick(id){
    socket.emit("kickPlayer", id)
}

function drawGameSession(){   
    background(50)

    facing =  Math.atan((mouseY - height/2) / (mouseX  - width/2))
    if(mouseX < width/2){
        facing = facing + Math.PI
    }
    lights.noErase()
    lights.clear()
    lights.background(0,0,0,230)
    lights.erase()

    if(players[playerID]){
        thisPlayer = players[playerID]
        camX = thisPlayer.pos[0] * cellSize
        camY = thisPlayer.pos[1] * cellSize

        push()
        lights.push()
        translate(width/2 - camX, height/2 - camY)
        lights.translate(width/2 - camX, height/2 - camY)
        if(thisMap){
            drawWorld()
        }
        pop()
        lights.pop()

        lights.arc(width/2, height/2, lights.width, lights.width, players[playerID].facing - 0.6, players[playerID].facing + 0.6)
        image(lights, 0, 0) //draws the flashlight canvas on

        fill("red") 
        textAlign(CENTER,CENTER)
        textSize(cellSize * 0.2)
        strokeWeight(cellSize * 0.01)
        textSize()
        i = players[playerID]
        text(i.userName, width/2, height/2 - 0.75 * cellSize )
        fill("blue")
        circle(width/2,height/2,cellSize)

        drawHud()
    }
    if(menuUp){
        fill(0,0,0,100)
        rect(0,0,width,height)
    }

    socket.emit("mouseLocation", mouseX, mouseY , width, height)
}
function drawWorld() {
    strokeWeight(0)
    Ymax = Math.round(thisPlayer.pos[1] + mapSize * 1.5)
    if(Ymax > thisMap.length) {Ymax = thisMap.length}

    for (let j = Math.round(thisPlayer.pos[1] - mapSize * 1.5); j < Ymax; j++) {
        
        if(j < 0){j = 0}
        Xmax = Math.round(thisPlayer.pos[0] + mapSize * 1.5)
        if(Xmax > thisMap[j].length) {Xmax = thisMap[j].length}

        for(let i = Math.round(thisPlayer.pos[0] - mapSize * 1.5); i < Xmax; i++){
            if(i < 0){i = 0}

            switch (thisMap[j][i]) {
            case 0:
                fill(200);
                img = 0
                break;
            case 1:
                fill(50);
                img = 1
                break;
            case 2:
                fill("gray");
                img = 2
                break;
            default:
                console.log("ERROR the map is not loading properly")
                break;
            }
            if(i >= winArea[0]
            && i < winArea[1]
            && j >= winArea[2]
            && j < winArea[3]
            ) {
                fill(80)
            }
            square(i*cellSize,j*cellSize,cellSize * 1.01)
        }
    }  

    textSize(cellSize * 0.6)
    fill("black")
    textAlign(CENTER)
    text("Drop items here", (winArea[0] + (winArea[1] - winArea[0]) * 0.5) * cellSize, (winArea[2] + (winArea[3] - winArea[2]) * 0.5) * cellSize)

    drawItems() 
    drawEnemies()
    drawPlayers()
}
function drawItems() {
    strokeWeight(cellSize * 0.1) 
    fill("purple")
    for(let i = 0; i < items.length; i++){
        if(items[i].visible)
        square((items[i].pos[0] - 0.25) * cellSize , (items[i].pos[1] - 0.25) * cellSize, cellSize * 0.5)
    }


    for(let i = 0; i < levers.length; i++){
        if(levers[i].activated){
            fill("green")
        } else {
            fill("red")
        }

        square((levers[i].pos[0] - 0.25) * cellSize , (levers[i].pos[1] - 0.25) * cellSize, cellSize * 0.5)
    }
}
function drawEnemies() {
    strokeWeight(cellSize * 0.01)
    fill("red")

    for(let i = 0; i < enemies.length; i++) {
        j = enemies[i]
        circle(j.x * cellSize, j.y * cellSize, cellSize)
    }
}
function drawPlayers() {
    textAlign(CENTER,CENTER)
    textSize(cellSize * 0.2)
    strokeWeight(cellSize * 0.01)
    
    fill("green")
    for(let id in players) {
        if(id !== playerID){
            let i = players[id]

            lights.arc(i.pos[0] * cellSize, i.pos[1] * cellSize, lights.width, lights.width, i.facing - 0.6, i.facing + 0.6)
            lights.circle(i.pos[0] * cellSize ,i.pos[1] * cellSize,cellSize)
            circle(i.pos[0] * cellSize ,i.pos[1] * cellSize,cellSize)
            text(i.userName, i.pos[0] * cellSize,(i.pos[1] - 0.75) * cellSize )
        }
    }
}
function drawHud() {
    strokeWeight(0)
    fill("red")
    rect(healthBarXOffSet, healthBarYOffSet , 2 * cellSize * players[playerID].health / 100 , 0.25 * cellSize)
    fill("green")
    rect(healthBarXOffSet, healthBarYOffSet + 0.5 * cellSize , 2 * cellSize * players[playerID].stamina / 100, 0.25 * cellSize)

    noFill()
    strokeWeight(0.01 * cellSize)
    rect(healthBarXOffSet, healthBarYOffSet , 2 * cellSize, 0.25 * cellSize)
    rect(healthBarXOffSet, healthBarYOffSet + 0.5 * cellSize , 2 * cellSize, 0.25 * cellSize)

    //objectives
    let itemsCollected = 0
    for(let i = 0; i < items.length; i++ ) {
        let target = items[i]
        if(target.pos[0] > winArea[0]
        && target.pos[0] < winArea[1]
        && target.pos[1] > winArea[2]
        && target.pos[1] < winArea[3]) {
            itemsCollected ++
        }
    }
    let leversActivated = 0
    for(let i = 0; i < levers.length; i++ ) {
        if(levers[i].activated) {
            leversActivated ++
        }
    }
    textSize(cellSize * 0.2)
    textAlign(CENTER)
    fill("red")
    strokeWeight(0)
    text("Parts collected: " + itemsCollected + "/" + items.length, width/2, cellSize * 0.2)
    text("Levers activated: " + leversActivated + "/" + levers.length, width/2, cellSize * 0.4)
}

function refreshSession() {
    buttons = []
    texts = []
    localStorage.setItem("inSession", true)
    console.log("session refresh")
}
function menu() {
    texts = []
    buttons = []
    if(menuUp) {
        menuUp = false
    } else {
        menuUp = true
        buttons.push(new myButton(width/2 - 2 * cellSize, cellSize * 0.5, cellSize * 4, cellSize, "Back",[255,0,0], cellSize/2, CENTER, menu))
        buttons.push(new myButton(width/2 - 2 * cellSize, cellSize * 1.5, cellSize * 4, cellSize, "Options",[255,0,0], cellSize/2, CENTER, options))
        buttons.push(new myButton(width/2 - 2 * cellSize, cellSize * 2.5, cellSize * 4, cellSize, "Controls",[255,0,0], cellSize/2, CENTER, controls))
        buttons.push(new myButton(width/2 - 2 * cellSize, cellSize * 3.5, cellSize * 4, cellSize, "Leave",[255,0,0], cellSize/2, CENTER, areYouSure))
    }
}
function areYouSure() {
    buttons = []
    buttons.push(new myButton(width/2 - 3 * cellSize, cellSize * 4, cellSize * 3, cellSize, "Yes",[255,0,0], cellSize/2, CENTER, leaveSession))
    buttons.push(new myButton(width/2, cellSize * 4, cellSize * 3, cellSize, "No",[255,0,0], cellSize/2, CENTER, noLeave))

    texts = []
    texts.push(new textBox(width/2, cellSize * 2.5, cellSize * 0.5, CENTER, [255,0,0], "Are you sure you want to leave?"))
}
function leaveSession() {
    menuUp = false 
    socket.emit("leaveSession")
    localStorage.setItem("inSession", false)
}
function noLeave () {
    menuUp = false 
    menu()
}
function controls() {
    buttons = []
    buttons.push(new myButton(width/2 - 2 * cellSize, cellSize * 0.5, cellSize * 4, cellSize, "Back",[255,0,0], cellSize/2, CENTER, noLeave))

    texts = []
    texts.push(new textBox(width/2 - cellSize * 3, cellSize * 2, cellSize * 0.5, LEFT, [255,0,0], "Move up"))
    texts.push(new textBox(width/2 - cellSize * 3, cellSize * 2.5, cellSize * 0.5, LEFT, [255,0,0], "Move left"))
    texts.push(new textBox(width/2 - cellSize * 3, cellSize * 3, cellSize * 0.5, LEFT, [255,0,0], "Move down"))
    texts.push(new textBox(width/2 - cellSize * 3, cellSize * 3.5, cellSize * 0.5, LEFT, [255,0,0], "Move right"))

    texts.push(new textBox(width/2 + cellSize * 1.5, cellSize * 2, cellSize * 0.5, CENTER, [255,0,0], "W"))
    texts.push(new textBox(width/2 + cellSize * 1.5, cellSize * 2.5, cellSize * 0.5, CENTER, [255,0,0], "A"))
    texts.push(new textBox(width/2 + cellSize * 1.5, cellSize * 3, cellSize * 0.5, CENTER, [255,0,0], "S"))
    texts.push(new textBox(width/2 + cellSize * 1.5, cellSize * 3.5, cellSize * 0.5, CENTER, [255,0,0], "D"))
}
function options () {
    buttons = []
    buttons.push(new myButton(width/2 - 2 * cellSize, cellSize * 0.5, cellSize * 4, cellSize, "Back",[255,0,0], cellSize/2, CENTER, noLeave))
    
    texts = []
    texts.push(new textBox(width/2, cellSize * 2, cellSize * 0.3, CENTER, [255,0,0], "Health bar and stamina bar location"))

    buttons.push(new myButton(width/2 - cellSize, cellSize * 2.5, cellSize, cellSize, "Top left",[255,0,0], cellSize/8, CENTER, changeBarsLocation, "TopLeft"))
    buttons.push(new myButton(width/2, cellSize * 2.5, cellSize, cellSize, "Top Right",[255,0,0], cellSize/8, CENTER, changeBarsLocation, "TopRight"))
    buttons.push(new myButton(width/2 - cellSize, cellSize * 3.5, cellSize, cellSize, "Bottom Left",[255,0,0], cellSize/8, CENTER, changeBarsLocation, "BottomLeft"))
    buttons.push(new myButton(width/2, cellSize * 3.5, cellSize, cellSize, "Bottom right",[255,0,0], cellSize/8, CENTER, changeBarsLocation, "BottomRight"))
}
function changeBarsLocation(location) {
    switch(location) {
        case "TopLeft":
            healthBarXOffSet = 0.1 * cellSize
            healthBarYOffSet = 0.1 * cellSize
            break;
        case "TopRight":
            healthBarXOffSet = width - 2.1 * cellSize
            healthBarYOffSet = 0.1 * cellSize
            break;
        case "BottomLeft":
            healthBarXOffSet = 0.1 * cellSize
            healthBarYOffSet = height - 0.85 * cellSize
            break;
        case "BottomRight":
            healthBarXOffSet = width - 2.1 * cellSize
            healthBarYOffSet = height - 0.85 * cellSize
            break;
    }
}

function drawWinScreen() {
    background(50)

    for(let i = 0; i < tempPlayers.length; i++){
        let j = tempPlayers[i]
        noFill()
        stroke("red")
        strokeWeight(playerSpacing / 2)
        square(i * width/4 + playerSpacing, height * 0.25 - width/8 + playerSpacing, width/4 - playerSpacing * 2)
    
        strokeWeight(cellSize * 0.01)
        stroke("black")
        fill("black")
        textSize(cellSize * 0.3)
        textAlign(CENTER,CENTER)
        text(j.userName, i * width/4 + width/8, height * 0.25)
        
        strokeWeight(0)
        fill("red")
        rect(i * width/4 + playerSpacing, height * 0.5, (width/4 - playerSpacing * 2) * (j.healthDisplay /100), cellSize * 0.2)

        strokeWeight(0.01 * cellSize)
        noFill()
        rect(i * width/4 + playerSpacing, height * 0.5, width/4 - playerSpacing * 2, cellSize * 0.2)

        if(j.healthDisplay > j.health){
            j.healthDisplay -= 0.5
        }
        if(j.healthDisplay <= 0){

        }
    }
}

function leaveWinScreen() {
    winScreen = false
    refreshLobbies()
}
