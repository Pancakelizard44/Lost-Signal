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
        this.v = 1/20
        this.move = [0,0]
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
}
function isWall(x,y,inputMap){
    x = Math.floor(x)
    y = Math.floor(y)
    if(inputMap[y][x] === 1 || inputMap[y][x] === 2) {return true}
    return false
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
        this.players = lobby.players
        this.id = lobby.id
        delete lobbies[this.id]
        for(let i = 0; i < lobby.priority.length; i++){
            players[lobby.priority[i]].group = "gameSession"
        }
        this.loop = setInterval(gameSessionUpdate,16,this.id)
        this.map = maps[0]
    }
}

let players = {}
let offlinePlayers = {}
let lobbies = {}
let sessions = {}
let myTimeout = false

//server communication with client
io.on("connection", (socket) => {
    let playerID = socket.handshake.auth.playerID
    let userName = socket.handshake.auth.userName

    if(players[playerID]){
        debug("A player has reconnected")
        players[playerID].socketID = socket.id
        console.log("playerID:", playerID, " socketID:", socket.id)

        if(myTimeout){
            clearTimeout(myTimeout)
        }
    } else if(offlinePlayers[playerID]){
        debug("A player that was offline has reconnected")
        console.log("playerID:", playerID, " socketID:", socket.id)
        players[playerID] = offlinePlayers[playerID]
        delete offlinePlayers[playerID]
        players[playerID].socketID = socket.id
        
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
                    sessions[thisPlayer.sessionID].players[playerID].vect[1] = -1
                    break;
                case 65 || 37:
                    sessions[thisPlayer.sessionID].players[playerID].vect[0] = -1
                    break;
                case 83 || 40:
                    sessions[thisPlayer.sessionID].players[playerID].vect[1] = 1
                    break;
                case 68 || 39:
                    sessions[thisPlayer.sessionID].players[playerID].vect[0] = 1
                    break;
            }
        }

    })
    socket.on("keyUp", (a) => {
        thisPlayer = players[playerID]
        if(players[playerID].group = "gameSession"){
            let xv = sessions[thisPlayer.sessionID].players[playerID].vect[0]
            let yv = sessions[thisPlayer.sessionID].players[playerID].vect[1]
            switch(a) {
                case 87 || 38:
                    if(yv < 0)
                    sessions[thisPlayer.sessionID].players[playerID].vect[1] = 0
                    break;
                case 65 || 37:
                    if(xv < 0)
                    sessions[thisPlayer.sessionID].players[playerID].vect[0] = 0
                    break;
                case 83 || 40:
                    if(yv > 0)
                    sessions[thisPlayer.sessionID].players[playerID].vect[1] = 0
                    break;
                case 68 || 39:
                    if(xv > 0)
                    sessions[thisPlayer.sessionID].players[playerID].vect[0] = 0
                    break;
            }
            
        }
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
    if(sessions[i].players)
    for(let id in sessions[i].players){
        let j = sessions[i].players[id]
        j.checkTarget()
        j.pos[0] += j.move[0] * j.v
        j.pos[1] += j.move[1] * j.v

        io.to(j.socketID).emit("gameSessionUpdate", sessions[i])
    }
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
    //11-right 12-up 13-left 14-down
    //15-start room
    //16-full room
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
        [1, 0, 0, 0, 0, 0, 2, 2, 2],
        [1, 0, 0, 0, 0, 0, 2, 2, 2],
        [1, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
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
    [5,1,1,1,8],
    [4,0,0,0,2],
    [4,0,0,0,2],
    [4,0,0,0,2],
    [6,3,3,3,7],
]
mapGrids[1] = [
    [16,5,13,16],
    [11,0,1,10],
    [16,9,9,16],
    [16,6,2,16],
    [16,11,2,16],
    [16,14,9,16],
    [15,0,2,16],
    [16,9,16,16],
    [16,6,16,16],
    [16,16,16,16],
    [16,16,16,16],
    [16,16,16,16],
]

maps = []
maps[0] = createMap(mapGrids[0])
maps[1] = createMap(mapGrids[1])

spawns = []
spawns[0] = [4.5,4.5]
spawns[1] = [4.5, 6.5 * 9]
