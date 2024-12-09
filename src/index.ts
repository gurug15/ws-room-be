import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocket, WebSocketServer } from 'ws';

type RoomIdType = {
    roomId: string;
}

type Message = {
    roomId: string;
    content: string;
    timestamp?: number;
}

type DataType = 
    | { type: "joinRoom", payload: RoomIdType }
    | { type: "message", payload: Message }
    | { type: "fetchMessages", payload: RoomIdType };

const rooms: Record<string, WebSocket[]> = {};
const roomMessages: Record<string, Message[]> = {};

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const ws = new WebSocketServer({ server });
const PORT = 4000;

const messages : Message[] = []

ws.on('connection', function(socket) {
    socket.on('message', function message(event) {
        try {
            const data: DataType = JSON.parse(event.toString());
            switch (data.type) {
                case 'joinRoom':
                    const { roomId } = data.payload;
                    if (!rooms[roomId]) {
                        rooms[roomId] = [];
                        roomMessages[roomId] = [];
                    }

                    if (!rooms[roomId].includes(socket)) {
                        rooms[roomId].push(socket);
                    }

                    // Send existing messages for the room
                    socket.send(JSON.stringify({
                        type: 'joinRoom',
                        roomId: roomId,
                        messages: roomMessages[roomId]
                    }));
                    break;

                case 'message':
                    const messagePayload = {
                        ...data.payload,
                        timestamp: Date.now()
                    };

                    const roomSockets = rooms[messagePayload.roomId] || [];
                    roomSockets.forEach(user => {
                        if (user !== socket && user.readyState === WebSocket.OPEN) {
                            user.send(JSON.stringify({
                                type: 'message',
                                message: messagePayload
                            }));
                        }
                    });

                    // Store message in room-specific message history
                    roomMessages[messagePayload.roomId].push(messagePayload);
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    socket.on('close', () => {
        // Remove socket from all rooms
        Object.keys(rooms).forEach(roomId => {
            rooms[roomId] = rooms[roomId].filter(s => s !== socket);
        });
    });
});

app.get("/messages/:roomId", (req, res) => {
    const { roomId } = req.params;
    const messages = roomMessages[roomId] || [];
    res.status(200).json({ messages });
});

// app.post("/messages",(req,res) => {
//         const message: Message = req.body.message
//         messages.push(message)
//         res.json({
//             message: "messeage added succesfully"
//         })
// })

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});