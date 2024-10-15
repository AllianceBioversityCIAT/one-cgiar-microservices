import { Socket } from 'socket.io';
import socketIO from 'socket.io';
import { UserList } from '../classes/user-list';
import { User } from '../classes/user';

export const userList = new UserList();

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

      const rooms = Array.from(client.rooms);
      rooms.forEach(room => {
        client.leave(room);
        io.to(room).emit(`room-users-${user.platform}`, getRoomUsers(io, room, user.platform));
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
