import { randomBytes } from "crypto";
import express from "express"
import { createServer } from "http";
import { disconnect } from "process";
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
//room map
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

    socket.on("join-room", (data) =>{
        const parsedData = JSON.parse(data);
        const roomCode = parsedData.roomId;

        const room = rooms.get(roomCode);

        if(!room){
            socket.emit("error", "room not found");
            return;
        }

        socket.join(roomCode);

        room.users.add(socket.id);
        room.lastActive = Date.now();

        socket.emit("joined-room", {
            roomCode,
            messages : room.messages
        })

        io.to(roomCode).emit('user-joined', room.users.size);
    })

    socket.on("send-message", ({ roomCode, message, userId, name}) => {
        const room = rooms.get(roomCode);
        if(room){
            room.lastActive = Date.now();
            const messageData : Message = {
                id : randomBytes(4). toString('hex'),
                content : message,
                senderId : userId,
                sender : name,
                timestamp :new Date()
            };
            room.messages.push(messageData);

            io.to(roomCode).emit("new-message", messageData);

        }
    })

    socket.on("disconnect", ()=>{
        rooms.forEach((room, roomCode) =>{
            if(room.users.has(socket.id)){
                room.users.delete(socket.id);
                io.to(roomCode).emit("user-left", room.users.size);

                if(room.users.size === 0){
                    console.log(`deleting empty room : ${roomCode}`);
                    rooms.delete(roomCode);
                }
            }
        })
    })
})


httpServer.listen(4000, ()=>{
    console.log("server running on 4000");
})