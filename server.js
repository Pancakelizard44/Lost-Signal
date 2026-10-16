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
        this.players = lobby.players
        this.id = lobby.id
        delete lobbies[this.id]
        for(let i = 0; i < lobby.priority.length; i++){
            players[lobby.priority[i]].group = "gameSession"
        }
        this.loop = setInterval(gameSessionUpdate,16,this.id)
        this.map = maps[0]
        for(let id in this.players){
            let i = this.players[id]
            i.pos = [0,0]
            i.vector = [0,0]
            i.v = 1/20
        }
    }
}

let players = {}
let offlinePlayers = {}
let lobbies = {}
let sessions = {}

//server communication with client
io.on("connection", (socket) => {
    let playerID = socket.handshake.auth.playerID
    let userName = socket.handshake.auth.userName

    if(players[playerID]){
        debug("A player has reconnected")
        players[playerID].socketID = socket.id
        console.log("playerID:", playerID, " socketID:", socket.id)
        if(players[playerID].group === "gameSession"){
            gameSessionUpdate(sessions[players[playerID].sessionID])
        }
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
                case 87:
                    sessions[thisPlayer.sessionID].players[playerID].vector[1] = -1
                    break;
                case 65:
                    sessions[thisPlayer.sessionID].players[playerID].vector[0] = -1
                    break;
                case 83:
                    sessions[thisPlayer.sessionID].players[playerID].vector[1] = 1
                    break;
                case 68:
                    sessions[thisPlayer.sessionID].players[playerID].vector[0] = 1
                    break;
            }
        }

    })
    socket.on("keyUp", (a) => {
        thisPlayer = players[playerID]
        if(players[playerID].group = "gameSession"){
            switch(a) {
                case 87:
                    sessions[thisPlayer.sessionID].players[playerID].vector[1] = 0
                    break;
                case 65:
                    sessions[thisPlayer.sessionID].players[playerID].vector[0] = 0
                    break;
                case 83:
                    sessions[thisPlayer.sessionID].players[playerID].vector[1] = 0
                    break;
                case 68:
                    sessions[thisPlayer.sessionID].players[playerID].vector[0] = 0
                    break;
            }
        }
    })


    socket.on("disconnect", (socket) => {
        debug("A player has disconnected")
        console.log("playerID:", playerID)
        myTimeout = setTimeout(() => {
            if(players[playerID].group === "lobby"){
            lobbies[players[playerID].sessionID].disconnect(playerID)
            }

            debug("A player has been moved to offline for being disconnected for too long")

            offlinePlayers[playerID] = players[playerID]
            delete players[playerID]

            console.log("playerID:", playerID, " socketID:", socket.id)
        }, 10000)
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
    for(let id in sessions[i].players){
        let j = sessions[i].players[id]
        j.pos[0] += j.vector[0] * j.v
        j.pos[1] += j.vector[1] * j.v
        if(j.vector ==! [0,0]){console.log(j.vector)}

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
    [
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [2, 2, 2, 0, 0, 0, 2, 2, 2],
        [2, 2, 2, 0, 0, 0, 2, 2, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 2, 2, 2],
        [2, 2, 2, 2, 2, 2, 2, 2, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [2, 2, 2, 0, 0, 0, 1, 1, 1],
        [2, 2, 2, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [2, 2, 2, 0, 0, 0, 2, 2, 2],
        [2, 2, 2, 0, 0, 0, 2, 2, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 2, 2, 2],
        [1, 1, 1, 0, 0, 0, 2, 2, 2],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],

    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 2, 2, 2, 2, 2, 2],
        [1, 1, 1, 2, 2, 2, 2, 2, 2],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 2, 2, 2],
        [1, 1, 1, 0, 0, 0, 2, 2, 2],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [2, 2, 2, 0, 0, 0, 1, 1, 1],
        [2, 2, 2, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
    ],[
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
    ],[
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 2, 2, 2],
        [2, 2, 2, 2, 2, 2, 2, 2, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
    ]
]

function createArray(w,h,fill){
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

    for(let i = 0; i < arr.length; i ++) {
        for(let j = 0; j < arr[0].length; j++){
            for(let k = 0; k < 9; k++){
                for(let l = 0; l < 9; l++){
                    thisMap[k + 9 * i][l + 9 * j] = mapPresets[arr[i][j]][k][l]
                }
            }
        }
    }

    return thisMap
}

mapGrid1 = [
    [5,1,1,1,8],
    [4,0,0,0,2],
    [4,0,0,0,2],
    [4,0,0,0,2],
    [6,3,3,3,7],
]

maps = []
maps[0] = createMap(mapGrid1)
