# WebSocket Microservice

A TypeScript-based microservice for real-time communication using WebSockets, built with Node.js, Express, and Socket.IO.

## Overview

This microservice provides real-time communication capabilities for web applications, allowing users to connect from different platforms and receive instant notifications, alerts, and participate in room-based conversations.

## Features

- **Real-time Communication**: WebSocket connections using Socket.IO
- **Multi-platform Support**: Users can connect from different platforms
- **Room Management**: Users can join and leave specific rooms
- **User Management**: Track connected users with custom metadata
- **REST API**: HTTP endpoints for external integrations
- **Global Alerts**: Broadcast messages to all connected users
- **Targeted Notifications**: Send notifications to specific users
- **Angular Integration**: Built-in support for Angular 18+ applications

## Architecture

### Core Classes

#### Server (`classes/server.ts`)

- **Singleton Pattern**: Ensures single server instance
- **HTTP & WebSocket Server**: Handles both REST API and Socket connections
- **CORS Enabled**: Configured for cross-origin requests
- **Port Configuration**: Uses environment variable or defaults to 3005

#### User (`classes/user.ts`)

```typescript
class User {
  socketId: string; // Unique socket connection ID
  userId: number; // Application user ID
  name: string; // Display name
  platform: string; // Platform identifier
}
```

#### UserList (`classes/user-list.ts`)

- **User Management**: Add, remove, and configure users
- **Platform Filtering**: Get users by specific platform
- **Socket Mapping**: Map between socket IDs and user IDs
- **Room Support**: Get users in specific rooms

### Socket Events

#### Connection Events

- `connection`: New user connects
- `disconnect`: User disconnects
- `config-user`: Configure user details (name, userId, platform)

#### Room Events

- `join-room`: Join a specific room
- `leave-room`: Leave a specific room
- `room-users-{platform}`: Broadcast room users to platform

#### Notification Events

- `alert-{platform}`: Global alert for platform
- `notifications`: Direct notification to user
- `all-connected-users-{platform}`: Broadcast all users for platform

## API Endpoints

### Base URL: `/socket`

#### POST /socket/alert

Send global alert to all users on a platform.

**Request Body:**

```json
{
  "platform": "string",
  "message": "string",
  "type": "string",
  "data": "any"
}
```

**Response:**

```json
{
  "ok": true,
  "body": "object"
}
```

#### POST /socket/notification

Send targeted notification to specific users.

**Request Body:**

```json
{
  "userIds": ["string[]"],
  "notification": "object",
  "platform": "string"
}
```

**Response:**

```json
{
  "ok": true,
  "notification": "object",
  "senders": "User[]"
}
```

#### GET /socket/users

Get all connected users.

**Response:**

```json
{
  "ok": true,
  "clients": "User[]"
}
```

#### GET /socket/users/:platform

Get users connected to specific platform.

**Response:**

```json
{
  "ok": true,
  "clients": "User[]"
}
```

## Installation & Setup

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd sockets-microservice

# Install dependencies
npm install

# Build the project
npm run build

# Start development mode
npm start
```

### Environment Variables

```bash
PORT=3005  # Server port (optional, defaults to 3005)
```

### Docker Setup

```bash
# Build Docker image
docker build -t sockets-microservice .

# Run with docker-compose
docker-compose up
```

## Client Integration

### Angular 18+ Integration

#### 1. Install ngx-socket-io

```bash
npm install ngx-socket-io
```

#### 2. Configure in app.config.ts

```typescript
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';

const config: SocketIoConfig = {
  url: 'http://localhost:3005',
  options: {}
};

export const appConfig: ApplicationConfig = {
  providers: [
    // ... other providers
    importProvidersFrom(SocketIoModule.forRoot(config))
  ]
};
```

#### 3. Create Socket Service

```typescript
import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  constructor(private socket: Socket) {}

  // Configure user
  configUser(name: string, userId: number, platform: string) {
    return this.socket
      .fromEvent('config-user')
      .pipe(tap(() => this.socket.emit('config-user', { name, userId, platform })));
  }

  // Listen for notifications
  getNotifications() {
    return this.socket.fromEvent('notifications');
  }

  // Listen for alerts
  getAlerts(platform: string) {
    return this.socket.fromEvent(`alert-${platform}`);
  }

  // Join room
  joinRoom(roomId: string, platform: string) {
    this.socket.emit('join-room', roomId, platform);
  }

  // Leave room
  leaveRoom(roomId: string, platform: string) {
    this.socket.emit('leave-room', roomId, platform);
  }
}
```

### JavaScript/HTML Integration

```html
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
<script>
  const socket = io('http://localhost:3005');

  // Configure user
  socket.emit(
    'config-user',
    {
      name: 'John Doe',
      userId: 123,
      platform: 'web'
    },
    response => {
      console.log(response);
    }
  );

  // Listen for notifications
  socket.on('notifications', data => {
    console.log('Notification received:', data);
  });

  // Listen for alerts
  socket.on('alert-web', data => {
    console.log('Alert received:', data);
  });
</script>
```

## Development

### Scripts

```bash
npm run build       # Build TypeScript to JavaScript
npm run start       # Start development with file watching
npm run test        # Run Jest tests
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint errors
```

### Project Structure

```
sockets-microservice/
├── classes/           # Core classes
│   ├── server.ts     # Main server class
│   ├── user.ts       # User model
│   └── user-list.ts  # User management
├── global/           # Global variables
│   └── vars.ts       # Configuration variables
├── routes/           # Express routes
│   ├── router.ts     # Main API routes
│   └── documentation-router.ts
├── sockets/          # Socket.IO handlers
│   └── socket.ts     # Socket event handlers
├── public/           # Static files
│   ├── index.html    # Documentation page
│   ├── styles.css    # Styles
│   └── code.js       # Client-side code
└── index.ts          # Application entry point
```

## Testing

### Unit Tests

```bash
npm test
```

### Manual Testing

1. Start the server: `npm start`
2. Open browser: `http://localhost:3005`
3. Open browser console
4. Test socket connection and events

## Deployment

### Production Build

```bash
npm run build
node dist/index.js
```

### Docker Deployment

```bash
docker build -t sockets-microservice .
docker run -p 3005:3005 sockets-microservice
```

## API Usage Examples

### Send Global Alert

```bash
curl -X POST http://localhost:3005/socket/alert \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "web",
    "message": "System maintenance in 5 minutes",
    "type": "warning"
  }'
```

### Send Targeted Notification

```bash
curl -X POST http://localhost:3005/socket/notification \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["123", "456"],
    "platform": "web",
    "notification": {
      "title": "New Message",
      "body": "You have a new message",
      "type": "info"
    }
  }'
```

### Get Connected Users

```bash
curl http://localhost:3005/socket/users
curl http://localhost:3005/socket/users/web
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a Pull Request

## License

ISC License

## Support

For questions and support, please refer to the documentation at `http://localhost:3005/documentation` when the server is running.
