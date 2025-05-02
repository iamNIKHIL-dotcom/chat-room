import { randomBytes } from "crypto";
import express from "express"
import { createServer } from "http";
import { Server } from "socket.io"



interface Message {
    id: string;
    content: string;
    senderId: string;
    sender:string;
    timestamp: Date;
}
  
interface RoomData {
    users: Set<string>;
    messages: Message[];
    lastActive: number;
}

const app = express();
const httpServer = createServer(app);


const io = new Server(httpServer, {
    cors :{
        origin : "*",
        methods:["GET","POST"]
    }
})

const rooms = new Map<string, RoomData>();

io.on('connection', (socket) =>{
    console.log("user connected :" , socket.id);

    // socket.on('set-user-id', (userId: string) =>{

    // });
    socket.on('create-room', () =>{
        const roomCode = randomBytes(3).toString('hex').toUpperCase();

        rooms.set(roomCode, {
            users : new Set<string>(),
            messages : [],
            lastActive: Date.now()
        });


        socket.emit('room-created', roomCode);
    })
})

httpServer.listen(4000, ()=>{
    console.log("server running on 4000");
})