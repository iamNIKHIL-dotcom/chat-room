"use client"
import Image, { type ImageProps } from "next/image";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import styles from "./page.module.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { ModeToggle } from "@/components/ThemeToggle"
import { Loader2, MessageCircleIcon } from "lucide-react";
import { io,Socket } from "socket.io-client"
import { ChangeEvent,useEffect, useState } from "react";
import { toast } from "sonner"

interface Message {
  id: string;
  content: string;
  senderId: string;
  sender:string;
  timestamp: Date;
}

interface ServerToClientEvents {
  'room-created': (code: string) => void;
  'joined-room': (data: { roomCode: string; messages: Message[] }) => void;
  'new-message': (message: Message) => void;
  'user-joined': (userCount: number) => void;
  'user-left': (userCount: number) => void;
  error: (message: string) => void;
}

interface ClientToServerEvents {
  'create-room': () => void;
  'join-room': (roomCode: string) => void;
  'send-message': (data: { roomCode: string; message: string; userId: string , name:string}) => void;
  'set-user-id': (userId: string) => void;
}


const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ;
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL);

export default function Home() {
  const [ connected, setConnected ] = useState<boolean>(false);
  const [ isLoading, setIsLoading ] = useState(false);
  const [ name, setName ] = useState<string>("");
  const [ inputCode, setInputCode ] = useState<string>("");
  const [ roomCode, setRoomCode ] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);


  //useEffects
  useEffect(() => {
    socket.on('room-created', (code) => {
      setRoomCode(code);
      setIsLoading(false);
      toast.success('Room created successfully!');
    });

    socket.on('joined-room', ({ roomCode, messages }) => {
      setRoomCode(roomCode);
      setMessages(messages);
      setConnected(true);
      setInputCode('');
      toast.success('Joined room successfully!');
    });
  })


  const createRoom = () => {
    setIsLoading(true);
    socket.emit("create-room");
  }
  const handleNameChange = (e : ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
  }
  const handleInputChange = (e : ChangeEvent<HTMLInputElement>) => {
    setInputCode(e.target.value)
  }
  const joinRoom = () => {
    if(!inputCode.trim()){
      toast.error("Please enter a room code");
      return;
    }

     
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    socket.emit('join-room', JSON.stringify({roomId:inputCode.toUpperCase(),name}));
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>
      <div className="container mx-auto max-w-2xl p-4 h-screen flex items-center justify-center">
        <Card className="w-full ">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl flex items-center gap-2 font-bold"> 
                <MessageCircleIcon className="w-6 h-6"/>
                Real Time Chat
                </CardTitle>
              <CardDescription>
               temporary room that expires after all users exit
              </CardDescription>
            </CardHeader>

            <CardContent>
              { !connected ? (
                <div className="space-y-4">
                  <Button onClick ={ createRoom }
                          className="w-full text-lg py-6"
                          size = "lg"
                          disabled= {isLoading}
                  >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-2 w-4 animate-spin "/>
                          Creating room..
                        </>
                      ): "Create New Room" }
                  </Button>
                  <div className="flex gap-2">
                  <Input
                    value={name}
                    onChange={handleNameChange}
                    placeholder="Enter your name"
                    className="text-lg py-5"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    value={inputCode}
                    onChange={handleInputChange}
                    placeholder="Enter Room Code"
                    className="text-lg py-5"
                  />
                  <Button 
                    onClick={joinRoom}
                    size="lg"
                    className="px-8"
                  >
                    Join Room
                  </Button>
                </div>


                </div>

              ) : "Create New Room"}

            </CardContent>
        </Card>

      </div>
      
    </>

  )
}
