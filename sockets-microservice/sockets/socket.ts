import { Socket } from 'socket.io';
import socketIO from 'socket.io';
import { UserList } from '../classes/user-list';
import { User } from '../classes/user';
import { RoomList } from '../classes/room-list';
import { RoomData } from '../classes/room';

export const userList = new UserList();
export const roomList = new RoomList();

export const connectSocketIO = (client: Socket) => {
  const user = new User(client.id);
  userList.addUser(user);
};

export const disconnectSocketIO = (client: Socket, io: socketIO.Server) => {
  client.on('disconnect', () => {
    const user = userList.deleteUser(client.id);

    console.log('disconnect: ', user);
    console.log(client.id);

    if (user) {
      io.emit(`all-connected-users-${user.platform}`, userList.getListByPlatform(user.platform));

      // Original room functionality
      const rooms = Array.from(client.rooms);
      rooms.forEach(room => {
        client.leave(room);
        io.to(room).emit(`room-users-${user.platform}`, getRoomUsers(io, room, user.platform));
      });

      // New functionality: clean up rooms with permissions
      const modifiedRooms = roomList.removeUserFromAllRooms(client.id);
      modifiedRooms.forEach(room => {
        const roomData = {
          roomId: room.roomId,
          users: room.getUsersArray(),
          data: room.data,
          lastEventId: room.lastEventId
        };

        io.to(room.roomId).emit(`room-updated-${user.platform}`, roomData);
      });
    }
  });
};

export const configUser = (client: Socket, io: socketIO.Server) => {
  client.on(
    'config-user',
    (
      payload: { name?: string; userId?: number; platform?: string },
      callback: (response: { ok: boolean; message: string }) => void
    ) => {
      const { name, userId, platform } = payload;
      userList.configUser(client.id, name, userId, platform);

      if (platform) {
        io.emit(`all-connected-users-${platform}`, userList.getListByPlatform(platform));
      }

      console.log(userList.getAllUsers());

      callback({
        ok: true,
        message: `user ${payload.name}, configured for platform ${platform}`
      });
    }
  );
};

export const joinRoom = (client: Socket, io: socketIO.Server) => {
  client.on('join-room', (roomId: string, platform: string) => {
    client.join(roomId);
    io.to(roomId).emit(`room-users-${platform}`, getRoomUsers(io, roomId, platform));
  });
};

export const leaveRoom = (client: Socket, io: socketIO.Server) => {
  client.on('leave-room', (roomId: string, platform: string) => {
    client.leave(roomId);
    io.to(roomId).emit(`room-users-${platform}`, getRoomUsers(io, roomId, platform));
  });
};

function getRoomUsers(io: socketIO.Server, roomId: string, platform: string) {
  const room = io.sockets.adapter.rooms.get(roomId);
  const socketsIds = room ? Array.from(room) : [];
  return userList.getUsersBySocketIds(socketsIds, platform);
}

// New functions for room management with permissions
interface RoomResponse {
  ok: boolean;
  message: string;
  room?: {
    roomId: string;
    users: Array<{ socketId: string; userId?: number; name: string; canEdit: boolean }>;
    data: RoomData;
    lastEventId: string;
    canEdit?: boolean;
  };
}

export const joinRoomWithPermissions = (client: Socket, io: socketIO.Server) => {
  client.on(
    'join-room-with-permissions',
    (payload: { roomId: string; platform: string }, callback: (response: RoomResponse) => void) => {
      const { roomId, platform } = payload;
      const user = userList.getUser(client.id);

      if (!user || !platform) {
        callback({ ok: false, message: 'User not configured or platform missing' });
        return;
      }

      // Join the Socket.IO room
      client.join(roomId);

      // Add user to our room management system
      const room = roomList.addUserToRoom(
        roomId,
        platform,
        client.id,
        user.userId || undefined,
        user.name
      );

      // Emit updated room information to all users
      const roomData = {
        roomId: room.roomId,
        users: room.getUsersArray(),
        data: room.data,
        lastEventId: room.lastEventId
      };

      io.to(roomId).emit(`room-updated-${platform}`, roomData);

      callback({
        ok: true,
        message: 'Successfully joined room with permissions',
        room: roomData
      });
    }
  );
};

export const leaveRoomWithPermissions = (client: Socket, io: socketIO.Server) => {
  client.on(
    'leave-room-with-permissions',
    (payload: { roomId: string; platform: string }, callback: (response: RoomResponse) => void) => {
      const { roomId, platform } = payload;

      // Leave the Socket.IO room
      client.leave(roomId);

      // Remove user from our room management system
      const room = roomList.removeUserFromRoom(roomId, platform, client.id);

      if (room) {
        // Emit updated room information
        const roomData = {
          roomId: room.roomId,
          users: room.getUsersArray(),
          data: room.data,
          lastEventId: room.lastEventId
        };

        io.to(roomId).emit(`room-updated-${platform}`, roomData);
      }

      callback({
        ok: true,
        message: 'Successfully left room'
      });
    }
  );
};

export const updateRoomData = (client: Socket, io: socketIO.Server) => {
  client.on(
    'update-room-data',
    (
      payload: { roomId: string; platform: string; data: RoomData; eventId?: string },
      callback: (response: RoomResponse) => void
    ) => {
      const { roomId, platform, data, eventId } = payload;

      const room = roomList.getRoom(roomId, platform);

      if (!room) {
        callback({ ok: false, message: 'Room not found' });
        return;
      }

      // Check if user has edit permissions
      if (!room.canUserEdit(client.id)) {
        callback({ ok: false, message: 'User does not have edit permissions' });
        return;
      }

      // Update room data
      room.updateData(data);

      // Set event ID if provided
      if (eventId) {
        room.setEventId(eventId);
      }

      // Emit changes to all users in the room
      const roomData = {
        roomId: room.roomId,
        users: room.getUsersArray(),
        data: room.data,
        lastEventId: room.lastEventId
      };

      io.to(roomId).emit(`room-updated-${platform}`, roomData);

      // Emit specific change event if eventId is provided
      if (eventId) {
        io.to(roomId).emit(`room-event-${platform}`, {
          roomId: room.roomId,
          eventId: eventId,
          data: data,
          timestamp: new Date()
        });
      }

      callback({
        ok: true,
        message: 'Room data updated successfully',
        room: roomData
      });
    }
  );
};

export const getRoomInfo = (client: Socket) => {
  client.on(
    'get-room-info',
    (payload: { roomId: string; platform: string }, callback: (response: RoomResponse) => void) => {
      const { roomId, platform } = payload;

      const room = roomList.getRoom(roomId, platform);

      if (!room) {
        callback({ ok: false, message: 'Room not found' });
        return;
      }

      const roomData = {
        roomId: room.roomId,
        users: room.getUsersArray(),
        data: room.data,
        lastEventId: room.lastEventId,
        canEdit: room.canUserEdit(client.id)
      };

      callback({
        ok: true,
        message: 'Room info retrieved successfully',
        room: roomData
      });
    }
  );
};
