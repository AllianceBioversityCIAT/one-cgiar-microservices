# Socket.IO Rooms with Permissions - Vanilla Example

This vanilla JavaScript example demonstrates how to use the Socket.IO rooms system with edit permissions and custom events.

## Main Concept 🎯

**Only the first user to join a room gets EDIT permissions**. All other users are **OBSERVERS** until the editor leaves.

## Quick Start ⚡

1. **Start the server**: Make sure the Socket.IO server is running on port 3005
2. **Open `index.html`** in your browser
3. **Configure your user** with platform, user ID, and name
4. **Choose a room** to test the functionality

## Directory Structure 📁

```
vanilla-example/
├── index.html          # Main page - user configuration
├── room1.html          # Room 1 - Documents
├── room2.html          # Room 2 - Tasks
├── room3.html          # Room 3 - Announcements
├── js/
│   └── socket-client.js # Documented client library
├── README.md           # This file
└── QUICK-GUIDE.md      # 5-minute quick guide
```

## How to Use 📚

### Step 1: User Configuration

1. Fill out the form on `index.html`
2. **Platform**: Groups users who can interact (e.g., 'room1', 'documents')
3. **User ID**: Optional numeric identifier
4. **Name**: Display name in rooms
5. Click "Configure User"

### Step 2: Choose a Room

Click on any of the 3 available rooms:

- **Room 1**: Document collaboration
- **Room 2**: Task management
- **Room 3**: Announcements board

### Step 3: Test Permissions

- **Editor**: Can modify content and send custom events
- **Observer**: Read-only access until editor leaves

## Key Features ✨

### Real-time Permissions

- First user = **EDITOR** (can modify content)
- Other users = **OBSERVERS** (read-only)
- When editor leaves, next user automatically becomes editor

### Custom Events

- Editors can send custom events with eventId
- All users receive events in real-time
- Event log shows all activity

### Multiple Rooms

- Each room operates independently
- Different content and user lists per room
- Seamless navigation between rooms

## Technical Implementation 🔧

### Client-Side Functions

```javascript
// Step 1: Connect (automatic)
// Step 2: Configure user
configUser(platform, userId, name);

// Step 3: Join room
joinRoomWithPermissions(roomId, callback);

// Step 4: Update data (editors only)
updateRoomData(roomId, data, eventId, callback);

// Step 5: Get room info
getRoomInfo(roomId, callback);
```

### Server Events

- `room-updated-{platform}`: General room updates
- `room-event-{platform}`: Custom events with eventId

## Example Usage Flow 🔄

1. **User A** joins Room 1 → Becomes **EDITOR**
2. **User B** joins Room 1 → Becomes **OBSERVER**
3. **User A** edits content → **User B** sees changes
4. **User A** leaves → **User B** becomes **EDITOR**
5. **User C** joins → Becomes **OBSERVER**

## Testing with Multiple Users 👥

1. Open multiple browser tabs/windows
2. Use different user names/IDs
3. Configure all with same platform (e.g., 'room1')
4. Join same room to test permissions
5. Try editing from different tabs

## Debugging 🔍

Check browser console for detailed logs:

- Connection status
- User configuration
- Room join/leave events
- Permission changes
- Custom events

## Compatible with Angular 18+ 🅰️

This vanilla example shows the same concepts that work in Angular:

```typescript
// Angular service example
export class SocketRoomService {
  configUser(platform: string, userId?: number, name: string = 'nameless') {
    // Same API as vanilla example
  }

  joinRoomWithPermissions(roomId: string) {
    // Same API as vanilla example
  }
}
```

## Need Help? 📖

- Read `QUICK-GUIDE.md` for a 5-minute tutorial
- Check the main project documentation
- Review `socket-client.js` for detailed function comments

---

**Note**: This example is designed for testing and learning. For production, add proper error handling, authentication, and validation.
