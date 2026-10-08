async function setup() {
    createCanvas(windowWidth,windowHeight)
    cellSize = floor(min(width / (mapSize + 2), height / (mapSize + 2)))

    inSession = await localStorage.getItem("inSession")

    if(inSession === 'true'){
        buttons.push(new myButton(width/2 - cellSize * 1.5,3*cellSize,3*cellSize,1*cellSize,"> Reconnect",[255,0,0],cellSize * 0.5,LEFT,serverConnection))
    }else{
        buttons.push(new myButton(width/2 - cellSize * 1.5,3*cellSize,3*cellSize,1*cellSize,"> Start",[255,0,0],cellSize * 0.5,LEFT,serverConnection))
    }

    textWrap(WORD)
}

let playerID = localStorage.getItem("playerID")
let userName = localStorage.getItem("userName")

if(!playerID){
    playerID = crypto.randomUUID()
    localStorage.setItem("playerID", playerID)
}
if(!userName){userName = undefined}

//Functions which will be used in all game states 
function serverConnection(){
    if(userName){
        if(userName.length >= 15){ myAlert("Usernames have a maximum of 15 characters") } else {
            localStorage.setItem("userName", userName)
            socket = io({
                auth:{playerID: playerID,userName: userName}
            })
            socket.on("close", () => {
                console.log("socket has closed")
            })


            buttons = []

            //data from server
            socket.on("preLobbyUpdate", (playerData,lobbyData) => {
                if(players[playerID]){
                    if(playerData[playerID].group === "preLobby"){
                        players = playerData
                        lobbies = lobbyData
                        refreshLobbies()
                    }
                } else { 
                    players = playerData
                    lobbies = lobbyData
                    refreshLobbies()
                }
            }) 
            socket.on("lobbyUpdate", (thisLobby) => {
                players = thisLobby.players
                lobby = thisLobby
                refreshLobby()
            })
            socket.on("gameSessionUpdate", (data) => {

            })

            socket.on("playerAlert", (data) => {
                myAlert(data)
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
        
    } else {
        if(a.keyCode <= 90 && a.keyCode >= 32){
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
document.addEventListener("keyup", (e) => {
    
})
function mouseClicked() {
    for(let i = 0; i <= buttons.length; i++){
        if(buttons[i]){
        buttons[i].check(mouseX,mouseY)
        }
    }
}

//variables defined on set up
let players = {}
let lobbies = {}
let buttons = []
let number = 0
let cellSize
let mapSize = 6
let connected = false
let myMessage = false
let correction = 0


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

//drawing
function draw(){
    if(players[playerID]){
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
    } else if(!connected){
        background(50)
        strokeWeight(cellSize * 0.005)
        textSize(cellSize * 0.2 * 0.8)
        textAlign(LEFT,CENTER)
        noFill()
        stroke("red")
        rect(width/2 - cellSize * 1.5,2.7*cellSize,3*cellSize,0.2*cellSize)
        fill("red")
        if(userName){
            text("Username> " + userName + " <",width/2 - cellSize * 1.5,2.8 *cellSize)
        } else {
            text("Username>  <",width/2 - cellSize * 1.5,2.8 * cellSize)
        }
    }
    for(let i = 0; i < buttons.length; i++){
        buttons[i].draw(mouseX,mouseY)
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
    buttons.push(new myButton(0, 0, width, 1 * cellSize,"> Create lobby",[255,0,0],cellSize * 0.4,LEFT, createLobby))
    k = 0
    j = 0
    for(let id in lobbies){
        let i = lobbies[id]
        if(j + 1.5 >= mapSize){ k++ }

        let lobbyText = "> " + players[i.priority[0]].userName + "'s lobby | players: " + i.priority.length + "/4"

        buttons.push(new myButton((k * 6) *cellSize, (j + 1.5) * cellSize, 5 * cellSize, 0.8 * cellSize, lobbyText , [255,0,0], cellSize * 0.3 ,LEFT, joinLobby, id))

        j++
    }
}


function drawLobby(){
    fill("red")
    background(50)
    let playerSpacing = width/20
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
    buttons.push(new myButton(0, height - cellSize * 2, width, cellSize, "> Leave", [255,0,0], cellSize / 2, LEFT, leave))
    if(playerID === lobby.priority[0]){
        buttons.push(new myButton(0, height - cellSize * 3, width,cellSize,"> Start",[255,0,0], cellSize/2,LEFT, startGameSession))
        for(let i = 1; i < lobby.priority.length; i ++){
            buttons.push(new myButton(i * width/4 + width/20, height/2 - width/32, width/4 - width/10, cellSize/2,"> Kick",[255,0,0],cellSize/3,CENTER,kick, lobby.priority[i]))
        }
    }
}
function startGameSession(){

}
function leave(){
    socket.emit("leaveLobby")
    localStorage.setItem("inSession", false)
}
function kick(id){

}


function drawGameSession(){
    
}