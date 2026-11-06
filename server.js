const express = require("express")
const http = require("http")
const socketIO = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = socketIO(server)

app.use(express.static("public"))

class player {
    constructor(playerID,socketID,group,name){
        this.playerID = playerID
        this.socketID = socketID
        this.group = group
        this.sessionID = 0
        this.userName = name
        this.pos = [4.5,4.5]
        this.vect = [0,0]
        this.v = playerWalkV
        this.move = [0,0]
        this.hitBox = 1 //this is ths length of the square which the player collition acts
        this.stamina = 100
        this.staminaIncreasing = false
        this.staminaTimeOut = false
        this.health = 100
        this.detectRange = 5
        this.holding = false
    }

    checkTarget() {
        let m = sessions[this.sessionID].map
        this.move = this.vect

        if(this.vect[0] > 0 
        && (isWall(this.pos[0] + this.hitBox * 0.5 + 0.05, this.pos[1] + this.hitBox * 0.5, m) 
        || isWall(this.pos[0] + this.hitBox * 0.5 + 0.05, this.pos[1] - this.hitBox * 0.5, m))) {
            this.move[0] = 0

        } else if(this.vect[0] < 0 
        && (isWall(this.pos[0] - this.hitBox * 0.5 - 0.05, this.pos[1] + this.hitBox * 0.5, m) 
        || isWall(this.pos[0] - this.hitBox * 0.5 - 0.05, this.pos[1] - this.hitBox * 0.5, m))) {
            this.move[0] = 0
        }

        if(this.vect[1] > 0 
        && (isWall(this.pos[0] + this.hitBox * 0.5, this.pos[1] + this.hitBox * 0.5 + 0.05, m) 
        || isWall(this.pos[0] - this.hitBox * 0.5, this.pos[1] + this.hitBox * 0.5 + 0.05, m))) {
            this.move[1] = 0

        } else if(this.vect[1] < 0 
        && (isWall(this.pos[0] + this.hitBox * 0.5, this.pos[1] - this.hitBox * 0.5 - 0.05, m) 
        || isWall(this.pos[0] - this.hitBox * 0.5, this.pos[1] - this.hitBox * 0.5 - 0.05, m))) {
            this.move[1] = 0
        }        
        
        let moveString = this.move[0] * this.move[1]

        if(moveString === 1 || moveString === -1) {
            this.move = [Math.pow(0.5,0.5) * this.move[0], Math.pow(0.5,0.5) * this.move[1]]
        }
    }

    staminaCheck() {
        if(this.stamina <= 0) {
            this.v = playerWalkV
        }
        if(this.v === playerWalkV && !this.staminaIncreasing && !this.staminaTimeOut) {
            this.staminaTimeOut = setTimeout(() => {
                this.staminaIncreasing = true
                this.staminaTimeOut = false
            }, 500)
        }
        
        if(this.staminaIncreasing && this.stamina < 100){
            this.stamina += 1
        }
    }

    interact(){
        let target

        for(let i = 0; i < sessions[this.sessionID].levers.length; i++){
            target = sessions[this.sessionID].levers[i]

            if(this.pos[0] < target.pos[0] + 1
                && this.pos[0] > target.pos[0] - 1
                && this.pos[1] < target.pos[1] + 1 
                && this.pos[1] > target.pos[1] - 1){

                target.activate()
                break
            } 

            if(i === sessions[this.sessionID].levers.length - 1){
                if(this.holding !== false){
                    sessions[this.sessionID].items[this.holding].drop()
                    this.holding = false
                } else 
                for(let j = 0; j < sessions[this.sessionID].items.length; j++){
                    target = sessions[this.sessionID].items[j]
            
                    if( target.visible
                    && this.pos[0] < target.pos[0] + 1 
                    && this.pos[0] > target.pos[0] - 1 
                    && this.pos[1] < target.pos[1] + 1 
                    && this.pos[1] > target.pos[1] - 1){

                        this.holding = j
                        target.pickUp(this.playerID)
                        break
                    }
                    console.log(target.pos)
                }
                console.log("test")
            }
        }    
    }
    
}
function isWall(x,y,inputMap){
    x = Math.floor(x)
    y = Math.floor(y)
    if(inputMap[y][x] === 1 || inputMap[y][x] === 2) {return true}
    return false
}

class item {
    constructor(arr, type){
        // arr = [Xmax, Xmin, Ymax, Ymin]
        this.pos = []
        this.pos[0] = arr[0] + Math.random() * (arr[1] - arr[0])
        this.pos[1] = arr[2] + Math.random() * (arr[3] - arr[2])
        this.type = type
        this.visible = true
        this.owner = 0 //playerID of the player who has the item 0 if no one is holding it
    }

    pickUp(ID){
        this.visible = false
        this.owner = ID
        debug("picked up")
    }
    drop(){
        this.pos[0] = players[this.owner].pos[0]
        this.pos[1] = players[this.owner].pos[1]
        this.visible = true
        this.owner = 0
        debug("dropped")
    }
}

class lever {
    constructor(arr) {
        this.pos = []
        this.pos[0] = arr[0]
        this.pos[1] = arr[1]
        this.activated = false
    }

    activate() {
        this.activated = true
    }
}

class lobby {
    constructor(id){
        this.priority = []
        this.players = {}
        this.id = id
    }

    join(playerData){
        this.players[playerData.playerID] = playerData
        this.priority[this.priority.length] = playerData.playerID
        players[playerData.playerID].sessionID = this.id
        players[playerData.playerID].group = "lobby"
        debug(lobbies)
        lobbyUpdate(this)
    }

    disconnect(playerID){
        for(let i = 0; i < this.priority.length; i++){
            if(this.priority[i] === playerID){
                this.priority.splice(i,1)
                this.priority[this.priority.length] = playerID
                break;         
            }
        }
        lobbyUpdate(this)
    }

    leave(playerID){
        for(let i = 0; i < this.priority.length; i++){
            if(this.priority[i] === playerID){
                this.priority.splice(i,1) 
            }
        }
        delete this.players[playerID] 
        players[playerID].sessionID = 0
        players[playerID].group = "preLobby"
        if(this.priority.length === 0){
            delete lobbies[this.id]
            debug("A lobby has been deleted for being empty")
        } 
        debug(this)
        lobbyUpdate(this)
        preLobbyUpdate()
    }
}

class gameSession {
    constructor(lobby){
        this.mapNumber = 0
        this.players = lobby.priority
        this.id = lobby.id
        delete lobbies[this.id]
        for(let i = 0; i < lobby.priority.length; i++){
            players[lobby.priority[i]].group = "gameSession"
            players[lobby.priority[i]].pos[0] = spawns[this.mapNumber][0]
            players[lobby.priority[i]].pos[1] = spawns[this.mapNumber][1]
            players[lobby.priority[i]].pos[0] += i
            gameSessionRefresh(players[lobby.priority[i]].socketID)
        }
        this.map = maps[this.mapNumber]
        this.loop = setInterval(gameSessionUpdate,16,this.id)
        this.items = []
        this.levers = []
        this.createItems()
    }

    leave(ID) {
        for(let i = 0; i < this.players.length; i ++){
            if(this.players[i] === ID){
                this.players.splice(i)
            }
        }
        players[ID].sessionID = 0
        players[ID].group = "preLobby"

        if(this.players.length === 0){
            clearInterval(this.loop)
            delete sessions[this.id]
            console.log("test")
        }
        preLobbyUpdate()
    }

    createItems() {
        console.log(leverSpawns[this.mapNumber][0])
        this.levers.push(new lever(leverSpawns[this.mapNumber][0]))
        this.levers.push(new lever(leverSpawns[this.mapNumber][1]))
        
        this.items.push(new item(itemSpawns[this.mapNumber][0], 0))
    }

}

let players = {}
let offlinePlayers = {}
let lobbies = {}
let sessions = {}
let myTimeout = false
playerSprintV = 1/10
playerWalkV = 1/20

//server communication with client
io.on("connection", (socket) => {
    let playerID = socket.handshake.auth.playerID
    let userName = socket.handshake.auth.userName

    if(players[playerID]){
        debug("A player has reconnected")
        socket.to(players[playerID].socketID).emit("closeTab")
        players[playerID].socketID = socket.id
        players[playerID].userName = userName
        console.log("playerID:", playerID, " socketID:", socket.id)

        if(myTimeout){
            clearTimeout(myTimeout)
        }
    } else if(offlinePlayers[playerID]){
        debug("A player that was offline has reconnected")
        console.log("playerID:", playerID, " socketID:", socket.id)
        players[playerID] = offlinePlayers[playerID]
        delete offlinePlayers[playerID]
        socket.to(players[playerID].socketID).emit("closeTab")
        players[playerID].socketID = socket.id
        players[playerID].userName = userName
        
        if(!(lobbies[offlinePlayers[playerID].socketID] || sessions[offlinePlayers[playerID].socketID])){
            players[playerID].sessionID = 0
        }      
    } else {
        debug("A new player has connected")
        console.log("playerID:", playerID, " socketID:", socket.id)
        players[playerID] = new player(playerID,socket.id,"preLobby",userName)
    }
    if(players[playerID].group === "lobby"){
        lobbyUpdate(lobbies[players[playerID].sessionID])
    } else if(players[playerID].group === "gameSession"){
        gameSessionRefresh(socket.id)
    } else {
        preLobbyUpdate()
    }
    

    socket.on("createLobby", () => {
        let lobbyID = crypto.randomUUID()
        lobbies[lobbyID] = new lobby(lobbyID)
        lobbies[lobbyID].join(players[playerID])
        preLobbyUpdate()
    })
    socket.on("joinLobby", (data) => {
        lobbies[data].join(players[playerID])
    })  
    socket.on("leaveLobby", () => {
        lobbies[players[playerID].sessionID].leave(playerID)
    })  
    socket.on("kickPlayer", (data) => {
        if(lobbies[players[playerID].sessionID].priority[0] === playerID){
            lobbies[players[data].sessionID].leave(data)
        }
        socket.to(players[data].socketID).emit("kicked")
    })


    socket.on("startGameSession", () => {
        sessions[players[playerID].sessionID] = new gameSession(lobbies[players[playerID].sessionID])
        debug("a new session has been created session ID: ", players[playerID].sessionID)
    })
    socket.on("keyDown", (a) => {
        thisPlayer = players[playerID]
        if(players[playerID].group = "gameSession"){
            switch(a) {
                case 87 || 38:
                    players[playerID].vect[1] = -1
                    break;
                case 65 || 37:
                    players[playerID].vect[0] = -1
                    break;
                case 83 || 40:
                    players[playerID].vect[1] = 1
                    break;
                case 68 || 39:
                    players[playerID].vect[0] = 1
                    break;
                case 16:
                    if(players[playerID].stamina > 0)
                    players[playerID].v = playerSprintV
                    players[playerID].staminaIncreasing = false
                    break;
                case 32:
                    players[playerID].interact()
                    break;
            }
        }

    })
    socket.on("keyUp", (a) => {
        thisPlayer = players[playerID]
        if(players[playerID].group = "gameSession" ){
            let xv = players[playerID].vect[0]
            let yv = players[playerID].vect[1]
            switch(a) {
                case 87 || 38:
                    if(yv < 0)
                    players[playerID].vect[1] = 0
                    break;
                case 65 || 37:
                    if(xv < 0)
                    players[playerID].vect[0] = 0
                    break;
                case 83 || 40:
                    if(yv > 0)
                    players[playerID].vect[1] = 0
                    break;
                case 68 || 39:
                    if(xv > 0)
                    players[playerID].vect[0] = 0
                    break;
                case 16:
                    players[playerID].v = playerWalkV
                    break;
            }
            
        }
    })
    socket.on("leaveSession", () => {
        sessions[players[playerID].sessionID].leave(playerID)
    })

    socket.on("disconnect", (socket) => {
        debug("A player has disconnected")
        console.log("playerID:", playerID)
        

        /* myTimeout = setTimeout(() => {
            if(players[playerID])
            if(players[playerID].group === "lobby"){
            lobbies[players[playerID].sessionID].disconnect(playerID)
            }

            debug("A player has been moved to offline for being disconnected for too long")

            offlinePlayers[playerID] = players[playerID]
            delete players[playerID]

            console.log("playerID:", playerID, " socketID:", socket.id)
        }, 10000) */
    })
})

setInterval(() => {
    io.emit("heartBeat")
}, 1000)

function preLobbyUpdate() {
    io.emit("preLobbyUpdate", players,lobbies)
}
function lobbyUpdate(i) {
    for(let id in i.players){
        let j = i.players[id]
        io.to(j.socketID).emit("lobbyUpdate", i)
    }
}

function gameSessionUpdate(i) {
    let playersToEmit = {}
    for(let a = 0; a < sessions[i].players.length; a++){
        b = players[sessions[i].players[a]]
        playersToEmit[b.playerID] = {
            playerID: b.playerID,
            socketID: b.socketID,
            group: b.group,
            sessionID: b.sessionID,
            pos: b.pos,
            vect: b.vect,
            health: b.health,
            stamina: b.stamina,
            userName: b.userName
        }
    }

    if(sessions[i].players)
    for(let j = 0; j < sessions[i].players.length; j++){
        let k = players[sessions[i].players[j]]
        k.checkTarget()
        k.staminaCheck()
        k.pos[0] += k.move[0] * k.v
        k.pos[1] += k.move[1] * k.v
        if(k.v === playerSprintV){k.stamina -= 0.5}

        io.to(k.socketID).emit("gameSessionUpdate", sessions[i].map, playersToEmit, sessions[i].items, sessions[i].levers)
    }
}
function gameSessionRefresh(i) {
    io.to(i).emit("gameSessionRefresh")
}

function debug(message){
    console.log("[DEBUG]", Date().substring(16,24), message)
}
function playerAlert(message){
    io.emit("playerAlert", message)
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server running on port ", PORT);
});

//map generation
let mapPresets = [
    //0-10 coridoors
    // 0 = crossroads
    //1-4 = t junction variations
    //1-down 2-left 3-up 4-right
    //5-8 = L junction variation
    //5-down&right 6-Up&right 7-Up&left 8-down&left
    //9-10 = straight variations
    //9-upToDown 10-leftToRight
    //dead end variations 
    //11-right 12-up 13-left 14-down the direction of the enterance
    //15 + = rooms
    //15-start room
    //16-full room
    //17-29 = empty rooms will 1 enterance
    //17-up 18-right 19-down 20-left
    [
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [2, 2, 2, 0, 0, 0, 2, 2, 2],
        [2, 2, 2, 0, 0, 0, 2, 2, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1]
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 2, 2, 2],
        [2, 2, 2, 2, 2, 2, 2, 2, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1]
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [2, 2, 2, 0, 0, 0, 1, 1, 1],
        [2, 2, 2, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1]
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [2, 2, 2, 0, 0, 0, 2, 2, 2],
        [2, 2, 2, 0, 0, 0, 2, 2, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 2, 2, 2],
        [1, 1, 1, 0, 0, 0, 2, 2, 2],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1]

    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 2, 2, 2, 2, 2, 2],
        [1, 1, 1, 2, 2, 2, 2, 2, 2],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1]
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 2, 2, 2],
        [1, 1, 1, 0, 0, 0, 2, 2, 2],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [2, 2, 2, 0, 0, 0, 1, 1, 1],
        [2, 2, 2, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1]
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1]
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 2, 2, 2],
        [2, 2, 2, 2, 2, 2, 2, 2, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 2, 2, 2, 2, 2, 2],
        [1, 1, 1, 2, 2, 2, 2, 2, 2],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 2, 2, 2, 1, 1, 1],
        [1, 1, 1, 2, 2, 2, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1]
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 2],
        [1, 0, 0, 0, 0, 0, 0, 0, 2],
        [1, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 2],
        [1, 0, 0, 0, 0, 0, 0, 0, 2],
        [1, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1]
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [2, 0, 0, 0, 0, 0, 0, 0, 1],
        [2, 0, 0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
    ]
]

function createArray(h,w,fill){
    let array = []
    for(let i = 0; i < h; i++){
        array[i] = []
        for(let j = 0; j < w; j++){
            array[i][j] = fill
        }
    }
    return array
}

function createMap(arr) {
    thisMap = createArray(arr.length * 9, arr[0].length * 9, 0)

    for(let i = 0; i < arr.length; i ++) { //grid y
        for(let j = 0; j < arr[0].length; j++){ //grid x
            for(let k = 0; k < 9; k++){ //map y
                for(let l = 0; l < 9; l++){ //map x
                    thisMap[k + 9 * i][l + 9 * j] = mapPresets[arr[i][j]][k][l]
                }
            }
        }
    }

    return thisMap
}

mapGrids = []
mapGrids[0] = [
    [16,14,16],
    [15,0,20],
    [16,16,16],
]
mapGrids[1] = [
    [16,5,13,16,16,16,16,16],
    [11,0,1,10,1,16,16,16],
    [16,9,9,16,4,10,8,16],
    [16,6,0,8,9,16,6,20],
    [16,11,2,17,9,16,14,16],
    [16,14,9,16,6,10,0,16],
    [15,0,2,16,16,16,9,19],
    [16,9,6,10,8,11,0,7],
    [16,6,1,16,9,16,9,16],
    [16,5,3,1,3,10,3,20],
    [16,6,10,3,13,16,16,16],
    [16,16,16,16,16,16,16,16],
]

let maps = []
maps[0] = createMap(mapGrids[0])
maps[1] = createMap(mapGrids[1])

let spawns = []
spawns[0] = [4.5,13.5]
spawns[1] = [4.5, 6.5 * 9]

//[Xmin,Xmax, Ymin,Ymax]
let itemSpawns = [[]]
itemSpawns[0][0] = [9 * 1.4, 9 * 1.6, 9 * 1.4, 9 * 1.6]

//[x,y]
let leverSpawns = [[]]
leverSpawns[0][0] = [1.5 * 9, 3.5]
leverSpawns[0][1] = [1.5 * 9, 17.5]
