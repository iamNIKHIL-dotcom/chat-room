"use client";
import Image, { type ImageProps } from "next/image";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { ModeToggle } from "@/components/ThemeToggle";
import { Copy, Loader2, MessageCircleIcon } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { ChangeEvent, useEffect, useState, useRef, FormEvent } from "react";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  senderId: string;
  sender: string;
  timestamp: Date;
}

interface ServerToClientEvents {
  "room-created": (code: string) => void;
  "joined-room": (data: { roomCode: string; messages: Message[] }) => void;
  "new-message": (message: Message) => void;
  "user-joined": (userCount: number) => void;
  "user-left": (userCount: number) => void;
  error: (message: string) => void;
}

interface ClientToServerEvents {
  "create-room": () => void;
  "join-room": (roomCode: string) => void;
  "send-message": (data: {
    roomCode: string;
    message: string;
    userId: string;
    name: string;
  }) => void;
  "set-user-id": (userId: string) => void;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;
const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
  io(SOCKET_URL);

const MessageGroup = ({
  messages,
  userId,
}: {
  messages: Message[];
  userId: string;
}) => {
  return (
    <div className="flex flex-col gap-y-2">
      {messages.map((msg, index) => {
        const isFirstInGroup =
          index === 0 || messages[index - 1]?.senderId !== msg.senderId;

        return (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.senderId === userId ? "items-end" : "items-start"
            }`}
          >
            {isFirstInGroup && (
              <div className="text-xs text-muted-foreground mb-0.5">
                {msg.sender}
              </div>
            )}
            <div
              className={`inline-block rounded-lg px-3 py-1.5 break-words ${
                msg.senderId === userId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              } ${!isFirstInGroup ? "mt-0.5" : "mt-1.5"}`}
            >
              {msg.content}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function Home() {
  const [connected, setConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState<string>("");
  const [inputCode, setInputCode] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<number>(0);
  const [userId, setUserId] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const storedUserId = localStorage.getItem("chatUserId") || crypto.randomUUID();
    localStorage.setItem("chatUserId", storedUserId);
    setUserId(storedUserId);
    socket.emit("set-user-id", storedUserId);

    const storedRoomCode = localStorage.getItem("chatRoomCode");
    const storedName = localStorage.getItem("chatUserName");

    if (storedRoomCode && storedName) {
      setName(storedName);
      setIsLoading(true);
      socket.emit("join-room", JSON.stringify({ roomId: storedRoomCode, name: storedName }));
    }
  }, []);

  useEffect(() => {
    if (connected) {
      localStorage.setItem("chatRoomCode", roomCode);
      localStorage.setItem("chatUserName", name);
    }
  }, [connected, roomCode, name]);

  useEffect(() => {
    socket.on("room-created", (code) => {
      setRoomCode(code);
      setIsLoading(false);
      toast.success("Room created successfully!");
    });

    socket.on("joined-room", ({ roomCode, messages }) => {
      setRoomCode(roomCode);
      setMessages(messages);
      setConnected(true);
      setInputCode("");
      setIsLoading(false);
      toast.success("Joined room successfully!");
    });

    socket.on("user-joined", (userCount) => {
      setUsers(userCount);
    });

    socket.on("new-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("user-left", (userCount) => {
      setUsers(userCount);
      toast.info("A user has left the room");
    });

    socket.on("error", (error) => {
      toast.error(error);
      setIsLoading(false);
      if (error === "Room not found" || error === "Room is full") {
        setInputCode("");
        localStorage.removeItem("chatRoomCode");
        localStorage.removeItem("chatUserName");
      }
    });

    return () => {
      socket.off("room-created");
      socket.off("joined-room");
      socket.off("new-message");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("error");
    };
  }, []);

  const createRoom = () => {
    setIsLoading(true);
    socket.emit("create-room");
  };

  const joinRoom = () => {
    if (!inputCode.trim()) return toast.error("Please enter a room code");
    if (!name.trim()) return toast.error("Please enter your name");
    socket.emit("join-room", JSON.stringify({ roomId: inputCode.toUpperCase(), name }));
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => setInputCode(e.target.value);
  const handleMessageChange = (e: ChangeEvent<HTMLInputElement>) => setMessage(e.target.value);

  const sendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    socket.emit("send-message", { roomCode, message, userId, name });
    setMessage("");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success("Room Copied to Clipboard!"))
      .catch(() => toast.error("Failed to copy room code"));
  };

  const leaveRoom = () => {
    socket.disconnect();
    socket.connect();
    localStorage.removeItem("chatRoomCode");
    localStorage.removeItem("chatUserName");
    setConnected(false);
    setRoomCode("");
    setMessages([]);
    setUsers(0);
    setName("");
    toast.info("You left the room");
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>
      <div className="flex items-center justify-center min-h-screen bg-background sm:px-6 lg:px-8">
<Card className="w-full max-w-2xl mx-auto rounded-lg shadow-md bg-background text-foreground   border-black">

          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl flex items-center gap-1 font-bold">
              <MessageCircleIcon className="w-9 h-9" />
              Real Time Chat
            </CardTitle>
            <CardDescription className="text-base">
              Temporary room that expires after all users exit
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {!connected ? (
              <div className="flex flex-col gap-3 px-4">
                <Button
                  onClick={createRoom}
className="w-full h-14 text-lg py-6 font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating room..
                    </>
                  ) : (
                    "Create New Room"
                  )}
                </Button>

                <Input
                  value={name}
                  onChange={handleNameChange}
                  placeholder="Enter your name"
                  className="text-lg py-4 h-12 w-full px-4 border-2 border-black"
                />

                <div className="flex gap-2">
                  <Input
                    value={inputCode}
                    onChange={handleInputChange}
                    placeholder="Enter Room Code"
                    className="text-lg h-12 w-full px-4 border-2 border-black"
                  />
                  <Button
                    onClick={joinRoom}
                    className=" w-40 h-12 px-6 py-2 font-semibold"
                  >
                    Join Room
                  </Button>
                </div>

                {roomCode && (
                  <div className="text-center p-6 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">
                      Share this code with your friend
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl font-bold">{roomCode}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(roomCode)}
                        className="h-8 w-8"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-3xl mx-auto flex flex-col gap-6">
                <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span>
                      Room Code:{" "}
                      <span className="font-mono font-bold">{roomCode}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(roomCode)}
                      className="h-6 w-6"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>Users: {users}</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={leaveRoom}
                      className="h-8"
                    >
                      Leave Room
                    </Button>
                  </div>
                </div>

                <div className="h-[430px] overflow-y-auto border rounded-lg p-4 space-y-2">
                  <MessageGroup messages={messages} userId={userId} />
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={sendMessage} className="flex gap-2">
                  <Input
                    value={message}
                    onChange={handleMessageChange}
                    placeholder="Type a message..."
                    className="text-lg py-5 border-black"
                  />
                  <Button type="submit" size="lg" className="px-8">
                    Send
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}