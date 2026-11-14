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
        this.stamina = 100              //value for the players stamina which will be increased/decreased
        this.staminaIncreasing = false  //boolean value for if the stamina should increase
        this.staminaTimeOut = false     //Will be reasigned to a timout but to prevent multiple instanses 
                                        // it is set to false 
        this.health = 100
        this.detectRange = 5
        this.holding = false
        this.facing
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
            // sets the player to walking velocity
            this.v = playerWalkV
        }
        if(this.v === playerWalkV && !this.staminaIncreasing && !this.staminaTimeOut) {
            //stamina timout is set to false up to this point so multiple instanses of the timeout occur
            this.staminaTimeOut = setTimeout(() => {
                this.staminaIncreasing = true
                this.staminaTimeOut = false
                //after the timout stamina timout is set to fasle so now the timout can start again
            }, 500)
        }
        
        if(this.staminaIncreasing && this.stamina < 100){
            //increases the stamina if the stamina is < 100 & stamina is meant to be increasing
            this.stamina += 1
        }
    }

    interact(){
        let target

        for(let i = 0; i < sessions[this.sessionID].levers.length; i++){
            //lever check
            target = sessions[this.sessionID].levers[i]

            if(this.pos[0] < target.pos[0] + 1
            && this.pos[0] > target.pos[0] - 1
            && this.pos[1] < target.pos[1] + 1 
            && this.pos[1] > target.pos[1] - 1){

                target.activate()
                break
            }
            
            //item check
            if(i === sessions[this.sessionID].levers.length - 1){
                if(this.holding !== false){
                    //checks if the player is already holding an item
                    //drops it if they do
                    sessions[this.sessionID].items[this.holding].drop()
                    this.holding = false
                } else 
                for(let j = 0; j < sessions[this.sessionID].items.length; j++){
                    //checks all items within the session to see if they are within range of the player

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
                }
            }
        }   
        
        sessions[this.sessionID].winCheck()
    }

    takeDamage(dmg) {
        this.health -= dmg
        this.deathCheck()
    }

    deathCheck () {
        if(this.group === "gameSession" && this.health <= 0) {
            sessions[this.sessionID].leave(this.playerID)
        }
    }  
}

class enemy {
    constructor(pos, v, range, Arange, ID) {
        this.x = pos[0]
        this.y = pos[1]
        this.v = v
        this.walkV = v * 0.8
        this.xv = 0
        this.yv = 0
        this.range = range
        this.attackRange = Arange
        this.sessionID = ID
        this.hitBox = 1
        this.attackDamage = 19
        this.attackTimeOut = false
        this.attacking 
        this.move = true
    }

    updateEnemy() {
        let distance = this.range
        let dx
        let dy

        for(let i = 0; i < sessions[this.sessionID].players.length ; i++) {
            let j = players[sessions[this.sessionID].players[i]]

            let distance2 = absDistance(this.x, this.y, j.pos[0], j.pos[1])

            if(distance2 < this.attackRange){
                this.damage(j.playerID)
                this.attacking = j.playerID
            } else if (this.attacking === j.playerID) {
                this.stopDamage()
            }

            if(distance2 < this.attackRange * 0.5){
                break;
            }
           
            if (distance2 < distance) {
                distance = distance2
                dx = this.x - j.pos[0]
                dy = this.y - j.pos[1]
            }
        }
        if(distance < this.range) {
            this.attack(dx,dy,distance)
        } else {
            this.roam()
        }

        if(this.move){
            this.x += this.xv
            this.y += this.yv
        }
    }

    attack(dx,dy,d) {
        this.move = true
        let m = sessions[this.sessionID].map

        let moveX = dx * (this.v / d)
        let moveY = dy * (this.v / d)

        this.xv = moveX * -1
        this.yv = moveY * -1

        if(this.xv > 0 
        && (isWall(this.x + this.hitBox * 0.5 + 0.05, this.y + this.hitBox * 0.5, m) 
        || isWall(this.x + this.hitBox * 0.5 + 0.05, this.y - this.hitBox * 0.5, m))) {
            this.xv = 0

        } else if(this.xv < 0 
        && (isWall(this.x - this.hitBox * 0.5 - 0.05, this.y + this.hitBox * 0.5, m) 
        || isWall(this.x - this.hitBox * 0.5 - 0.05, this.y - this.hitBox * 0.5, m))) {
            this.xv = 0
        }

        if(this.yv > 0 
        && (isWall(this.x + this.hitBox * 0.5, this.y + this.hitBox * 0.5 + 0.05, m) 
        || isWall(this.x - this.hitBox * 0.5, this.y + this.hitBox * 0.5 + 0.05, m))) {
            this.yv = 0

        } else if(this.yv < 0 
        && (isWall(this.x + this.hitBox * 0.5, this.y - this.hitBox * 0.5 - 0.05, m) 
        || isWall(this.x - this.hitBox * 0.5, this.y - this.hitBox * 0.5 - 0.05, m))) {
            this.yv = 0
        }  

        if(this.xv === 0) {
            if(this.yv > 0) {
                this.yv = this.v
            } else if (this.yv < 0){
                this.yv = this.v * -1
            }
        }
        if(this.yv === 0) {
            if(this.xv > 0) {
                this.xv = this.v
            } else if (this.xv < 0){
                this.xv = this.v * -1
            }
        }
    }

    damage(ID) {
        if(!this.attackTimeOut){
            this.attackTimeOut = setInterval(() => {players[ID].takeDamage(this.attackDamage)}, 1000)
        }
    }

    stopDamage() {
        if(this.attackTimeOut) {
            setTimeout( () => {
                clearInterval(this.attackTimeOut)
                this.attackTimeOut = false
            }, 500)
        }
    }

    roam() {
        if(Math.abs(this.xv) >= Math.abs(this.yv)){
            this.yv = 0
            if(this.xv > 0){
                this.xv = this.v
            } else {
                this.xv = this.v * -1
            }
        } else {
            this.xv = 0
            if(this.yv > 0){
                this.yv = this.v
            } else {
                this.yv = this.v * -1
            }
        }

        let m = sessions[this.sessionID].map

        if(this.xv > 0 
        && (isWall(this.x + this.hitBox * 0.5 + 1.05, this.y + this.hitBox * 0.5, m) 
        || isWall(this.x + this.hitBox * 0.5 + 1.05, this.y - this.hitBox * 0.5, m))) {
            this.xv = 0
            this.choseRandomDirection()
        } else if(this.xv < 0 
        && (isWall(this.x - this.hitBox * 0.5 - 1.05, this.y + this.hitBox * 0.5, m) 
        || isWall(this.x - this.hitBox * 0.5 - 1.05, this.y - this.hitBox * 0.5, m))) {
            this.xv = 0
            this.choseRandomDirection()
        }else if(this.yv > 0 
        && (isWall(this.x + this.hitBox * 0.5, this.y + this.hitBox * 0.5 + 1.05, m) 
        || isWall(this.x - this.hitBox * 0.5, this.y + this.hitBox * 0.5 + 1.05, m))) {
            this.yv = 0
            this.choseRandomDirection()
        } else if(this.yv < 0 
        && (isWall(this.x + this.hitBox * 0.5, this.y - this.hitBox * 0.5 - 1.05, m) 
        || isWall(this.x - this.hitBox * 0.5, this.y - this.hitBox * 0.5 - 1.05, m))) {
            this.yv = 0
            this.choseRandomDirection()
        } else {
            this.move = true
        }  
    }

    choseRandomDirection() {
        this.move = false
        let randomDirection = Math.round(Math.random() * 3)

        switch(randomDirection){
            case 0:
                this.xv = this.v
                break;
            case 1:
                this.xv = this.v * -1
                break;
            case 2:
                this.yv = this.v
                break;
            case 3:
                this.yv = this.v * -1
                break;
        }
    }
}

function absDistance(x1,y1,x2,y2) {
    return Math.sqrt((x1-x2) ** 2 + (y1-y2) ** 2)
} 
function isWall(x,y,inputMap){
    x = Math.floor(x)
    y = Math.floor(y)
    if(inputMap[y][x] === 1 || inputMap[y][x] === 2) {return true}
    return false
}

class item {
    constructor(arr, type, sessionID){
        // arr = [Xmax, Xmin, Ymax, Ymin]
        this.pos = []
        this.pos[0] = arr[0] + Math.random() * (arr[1] - arr[0])
        this.pos[1] = arr[2] + Math.random() * (arr[3] - arr[2])
        this.type = type
        this.visible = true //determines if the players can see it
        this.owner = 0 //playerID of the player who has the item 0 if no one is holding it
        this.sessionID = sessionID
    }


    pickUp(ID){
        //this just makes the item invisible and assigns the owner
        this.visible = false
        this.owner = ID
        debug("picked up")
    }
    drop(){
        //when this is called it will change the poistion of the item to the owners position
        //then will change the visibility to being true
        this.pos[0] = players[this.owner].pos[0]
        this.pos[1] = players[this.owner].pos[1]
        this.visible = true
        this.owner = 0
        debug("dropped")
        if(this.pos[0] > winAreas[sessions[this.sessionID].mapNumber][0]
        && this.pos[0] < winAreas[sessions[this.sessionID].mapNumber][1]
        && this.pos[1] > winAreas[sessions[this.sessionID].mapNumber][2]
        && this.pos[1] < winAreas[sessions[this.sessionID].mapNumber][3]
        ) {
            this.visible = false
        }
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
        this.mapNumber = 1
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
        this.enemies = []
        this.winArea  //[Xmin,Xmax, Ymin,Ymax]
        this.createEntities()
        this.win = false
    }

    leave(ID) {
        for(let i = 0; i < this.players.length; i ++){
            if(this.players[i] === ID){
                this.players.splice(i)
            }
        }
        players[ID].sessionID = 0
        players[ID].group = "preLobby"
        players[ID].health = 100

        if(this.players.length === 0){
            this.endSession()
        }
        preLobbyUpdate()
    }

    endSession() {
        clearInterval(this.loop)
        for(let i = 0; i < this.enemies.length; i++) {
            let j = this.enemies[i]
            if(j.attackTimeOut) {
                clearInterval(j.attackTimeOut)
            }
        }
        delete sessions[this.id]
    }

    createEntities() {
        //creates a lever for every lever spawn in the map and assigns it to the levers array of the session
        for(let i = 0; i < leverSpawns[this.mapNumber].length; i++){
            this.levers.push(new lever(leverSpawns[this.mapNumber][i]))
        }
        
        //creates an item for every item spawn in the map and assigns it to the items array of the session
        for(let i = 0; i < itemSpawns[this.mapNumber].length - 2; i++){
            this.items.push(new item(itemSpawns[this.mapNumber][i],0,this.id))
        }

        this.winArea = winAreas[this.mapNumber]

        for(let i = 0; i < enemySpawns[this.mapNumber].length; i ++) {
            this.enemies.push(new enemy(enemySpawns[this.mapNumber][i], 1/15, 5, 1, this.id))
        }
    }

    winCheck() {
        if(!this.win) //this stops the win scteen from being activated more than once
        this.win = true
        for(let i = 0; i < this.levers.length; i ++) {
            if(!this.levers[i].activated){
                //checks if any of the levers are not activated
                this.win = false
                break;
            }
        }
        if(this.win)
        for(let i = 0; i < this.items.length; i ++) {
            //checks if any items are outside the win area
            let target = this.items[i]
            if(target.pos[0] < this.winArea[0]
            || target.pos[0] > this.winArea[1]
            || target.pos[1] < this.winArea[2]
            || target.pos[1] > this.winArea[3]
            ){
                this.win = false
                break;
            }
        }
        if(this.win) {
            this.winGame()
        }
    }
    
    winGame(){
        let playersToEmit = {}
        for(let a = 0; a < this.players.length; a++){
            let b = players[this.players[a]]
            playersToEmit[b.playerID] = {
                playerID: b.playerID,
                socketID: b.socketID,
                group: "preLobby",
                sessionID: b.sessionID,
                health: b.health,
                healthDisplay: 100,
                userName: b.userName
            }
        }
        //creates copy of players

        clearInterval(this.loop)
        //stops the game session loop

        for(let j = 0; j < this.players.length; j++){
            let k = players[this.players[j]]
            k.group = "preLobby"
            io.to(k.socketID).emit("WIN", playersToEmit)
            preLobbyUpdate()
        }
        debug("WIn")
        delete sessions[this.id]
        //deletes the session
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
        console.log("playerID:", playerID, " socketID:", socket.id, " Group:", players[playerID].group)

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
        if(players[playerID].group === "gameSession"){
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
                    if(players[playerID].staminaTimeOut){
                        clearTimeout(players[playerID].staminaTimeOut)
                        players[playerID].staminaTimeOut = false
                    }
                    
                    break;
                case 32 || 69:
                    players[playerID].interact()
                    break;
            }
        }

    })
    socket.on("keyUp", (a) => {
        thisPlayer = players[playerID]
        if(players[playerID].group === "gameSession" ){
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
    socket.on("mouseLocation", (Xdata, Ydata, w, h) => {
        players[playerID].facing =  Math.atan((Ydata - h/2) / (Xdata  - w/2))
        if(Xdata < w/2){
            players[playerID].facing += Math.PI
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
    let playersToEmit = {}
    for(let id in players){
        let j = players[id]
        
        playersToEmit[id] = {
            playerID: j.playerID,
            socketID: j.socketID,
            group: j.group,
            sessionID: j.sessionID,
            userName: j.userName
        }
        io.to(j.socketID).emit("preLobbyUpdate", playersToEmit,lobbies)
    }   
}
function lobbyUpdate(i) {
    for(let id in i.players){
        let j = i.players[id]
        io.to(j.socketID).emit("lobbyUpdate", i)
    }
}

function gameSessionUpdate(i) {
    if(sessions[i].players){

    let playersToEmit = {}

    for(let a = 0; a < sessions[i].players.length; a++){
        b = players[sessions[i].players[a]]
        playersToEmit[b.playerID] = {
            playerID: b.playerID,
            group: b.group,
            pos: b.pos,
            vect: b.vect,
            health: b.health,
            stamina: b.stamina,
            userName: b.userName,
            facing: b.facing
        }
    }

    let enemiesToEmit = []

    for(let a = 0; a < sessions[i].enemies.length; a++){
        b = sessions[i].enemies[a]
        b.updateEnemy()
        enemiesToEmit[a] = {
            x: b.x,
            y: b.y
        }
    }

    for(let j = 0; j < sessions[i].players.length; j++){
        let k = players[sessions[i].players[j]]
        k.checkTarget()
        k.staminaCheck()
        k.pos[0] += k.move[0] * k.v
        k.pos[1] += k.move[1] * k.v
        if(k.v === playerSprintV && (k.vect[0] !== 0 || k.vect[1] !== 0)){k.stamina -= 0.5}

        io.to(k.socketID).emit("gameSessionUpdate", 
            sessions[i].map, 
            playersToEmit, 
            sessions[i].items, 
            sessions[i].levers, 
            sessions[i].winArea, 
            enemiesToEmit)
    }

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
    //0 = crossroads
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
let itemSpawns = [[],[]]
itemSpawns[0][0] = [9 * 1.4, 9 * 1.6, 9 * 1.4, 9 * 1.6]
itemSpawns[0][1] = [9 * 2.4, 9 * 2.6, 9 * 1.4, 9 * 1.6]
itemSpawns[0][2] = [9 * 2.4, 9 * 2.6, 9 * 1.4, 9 * 1.6]
itemSpawns[1][0] = [12.5, 14.5, 75.5, 77.5]
itemSpawns[1][1] = [12.5, 14.5, 93.5, 95.5]
itemSpawns[1][2] = [57.5, 59.5, 21.5, 23.5]
itemSpawns[1][3] = [42.5, 44.5, 12.5, 15.5]
itemSpawns[1][4] = [28.5, 34.5, 37.5, 43.5]
itemSpawns[1][5] = [28.5, 34.5, 37.5, 43.5]
itemSpawns[1][6] = [12.5, 14.5, 30.5, 32.5]
itemSpawns[1][7] = [12.5, 14.5, 39.5, 41.5]
itemSpawns[1][8] = [21.5, 23.5, 66.5, 68.5]

//[x,y]
let leverSpawns = [[],[]]
leverSpawns[0][0] = [1.5 * 9, 3.5]
leverSpawns[0][1] = [1.5 * 9, 17.5]
leverSpawns[1][0] = [13.5, 48.5]
leverSpawns[1][1] = [26.5, 76.5]
leverSpawns[1][2] = [41.5, 94.5]
leverSpawns[1][3] = [67.5, 85.5]
leverSpawns[1][4] = [67.5, 58.5]
leverSpawns[1][5] = [62.5, 49.5]
leverSpawns[1][6] = [3.5, 13.5]

//[Xmin,Xmax, Ymin,Ymax]
let winAreas = []
winAreas[0] = [1, 8, 9+1, 9+4]
winAreas[1] = [1, 8, 9 * 6 + 1, 9 * 6 + 3]

//[x,y]
let enemySpawns = [[],[]]
enemySpawns[1][0] = [22.5, 67.5]
enemySpawns[1][1] = [43.5, 13.5]
