import { Room, RoomData } from './room';

export class RoomList {
  private rooms: Room[] = [];

  public createRoom(roomId: string, platform: string): Room {
    const existingRoom = this.getRoom(roomId, platform);
    if (existingRoom) {
      return existingRoom;
    }

    const room = new Room(roomId, platform);
    this.rooms.push(room);
    return room;
  }

  public getRoom(roomId: string, platform: string): Room | null {
    return this.rooms.find(room => room.roomId === roomId && room.platform === platform) || null;
  }

  public deleteRoom(roomId: string, platform: string): Room | null {
    const roomIndex = this.rooms.findIndex(
      room => room.roomId === roomId && room.platform === platform
    );

    if (roomIndex === -1) return null;

    const deletedRoom = this.rooms[roomIndex];
    this.rooms.splice(roomIndex, 1);
    return deletedRoom;
  }

  public addUserToRoom(
    roomId: string,
    platform: string,
    socketId: string,
    userId?: number,
    name?: string
  ): Room {
    let room = this.getRoom(roomId, platform);

    if (!room) {
      room = this.createRoom(roomId, platform);
    }

    room.addUser(socketId, userId, name, platform);
    return room;
  }

  public removeUserFromRoom(roomId: string, platform: string, socketId: string): Room | null {
    const room = this.getRoom(roomId, platform);

    if (!room) return null;

    room.removeUser(socketId);

    // Si la sala está vacía, la eliminamos
    if (room.isEmpty()) {
      this.deleteRoom(roomId, platform);
      return null;
    }

    return room;
  }

  public removeUserFromAllRooms(socketId: string): Room[] {
    const modifiedRooms: Room[] = [];

    this.rooms.forEach(room => {
      const user = room.getUsers().find(u => u.socketId === socketId);
      if (user) {
        room.removeUser(socketId);
        modifiedRooms.push(room);
      }
    });

    // Eliminar salas vacías
    this.rooms = this.rooms.filter(room => !room.isEmpty());

    return modifiedRooms;
  }

  public updateRoomData(roomId: string, platform: string, data: RoomData): Room | null {
    const room = this.getRoom(roomId, platform);

    if (!room) return null;

    room.updateData(data);
    return room;
  }

  public getAllRooms(): Room[] {
    return this.rooms;
  }

  public getRoomsByPlatform(platform: string): Room[] {
    return this.rooms.filter(room => room.platform === platform);
  }
}
