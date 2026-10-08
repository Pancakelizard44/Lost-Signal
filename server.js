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
        preLobbyUpdate()
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
        preLobbyUpdate()
        lobbyUpdate(this)
    }
}

class gameSession {
    //players is an array containing the player IDs of all the players in the session
    constructor(players){
        this.sessionID = crypto.randomUUID()
        this.players = players
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
        if(myTimeout){
            clearTimeout(myTimeout)
        }
    } else if(offlinePlayers[playerID]){
        debug("A player that was offline has reconnected")
        console.log("playerID:", playerID, " socketID:", socket.id)
        players[playerID] = offlinePlayers[playerID]
        delete offlinePlayers[playerID]
        playerAlert("You were dissconnected from the game session for being away too long")
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
    })
    socket.on("joinLobby", (data) => {
        lobbies[data].join(players[playerID])
    })  
    socket.on("leaveLobby", () => {
        lobbies[players[playerID].sessionID].leave(playerID)
    })  

    socket.on("disconnect", (socket) => {
        debug("A player has disconnected")
        console.log("playerID:", playerID)

        if(players[playerID].group === "lobby"){
            lobbies[players[playerID].sessionID].disconnect(playerID)
        }

        myTimeout = setTimeout(() => {
            if(players[playerID].group === "lobby"){
            lobbies[players[playerID].sessionID].leave(playerID)
            }
            offlinePlayers[playerID] = players[playerID]
            delete players[playerID]

            debug("A player has been moved to offline for being disconnected for too long")
            console.log("playerID:", playerID, " socketID:", socket.id)
        }, 60000);
    })
})

setInterval(tickUpdates,16)

function tickUpdates(){
    gameSessionUpdate()
}
function preLobbyUpdate() {
    io.emit("preLobbyUpdate", players,lobbies)
}
function lobbyUpdate(i) {
    for(let id in i.players){
        let j = i.players[id]
        io.to(j.socketID).emit("lobbyUpdate", i)
    }
}

function gameSessionUpdate() {
    io.emit("gameSessionUpdate", )
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