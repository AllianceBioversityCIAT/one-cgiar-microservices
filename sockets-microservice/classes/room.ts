export interface RoomData {
  [key: string]: string | number | boolean | object | null | undefined;
}

export interface RoomUser {
  socketId: string;
  userId?: number;
  name: string;
  platform: string;
  canEdit: boolean;
  joinedAt: Date;
}

export class Room {
  public roomId: string;
  public platform: string;
  public users: RoomUser[] = [];
  public data: RoomData = {};
  public lastEventId: string = '';
  public createdAt: Date;
  public editorSocketId: string | null = null;

  constructor(roomId: string, platform: string) {
    this.roomId = roomId;
    this.platform = platform;
    this.createdAt = new Date();
  }

  public addUser(
    socketId: string,
    userId?: number,
    name: string = 'nameless',
    platform: string = 'general'
  ): RoomUser {
    // El primer usuario que entra puede editar
    const canEdit = this.users.length === 0;

    if (canEdit) {
      this.editorSocketId = socketId;
    }

    const roomUser: RoomUser = {
      socketId,
      userId,
      name,
      platform,
      canEdit,
      joinedAt: new Date()
    };

    this.users.push(roomUser);
    return roomUser;
  }

  public removeUser(socketId: string): RoomUser | null {
    const userIndex = this.users.findIndex(user => user.socketId === socketId);

    if (userIndex === -1) return null;

    const removedUser = this.users[userIndex];
    this.users.splice(userIndex, 1);

    // Si el editor se va, el siguiente usuario puede editar
    if (this.editorSocketId === socketId && this.users.length > 0) {
      this.users[0].canEdit = true;
      this.editorSocketId = this.users[0].socketId;
    } else if (this.users.length === 0) {
      this.editorSocketId = null;
    }

    return removedUser;
  }

  public getUsers(): RoomUser[] {
    return this.users;
  }

  public getUsersArray(): Array<{
    socketId: string;
    userId?: number;
    name: string;
    canEdit: boolean;
  }> {
    return this.users.map(user => ({
      socketId: user.socketId,
      userId: user.userId,
      name: user.name,
      canEdit: user.canEdit
    }));
  }

  public updateData(newData: RoomData): void {
    this.data = { ...this.data, ...newData };
  }

  public setEventId(eventId: string): void {
    this.lastEventId = eventId;
  }

  public isEmpty(): boolean {
    return this.users.length === 0;
  }

  public getEditor(): RoomUser | null {
    return this.users.find(user => user.canEdit) || null;
  }

  public canUserEdit(socketId: string): boolean {
    const user = this.users.find(user => user.socketId === socketId);
    return user ? user.canEdit : false;
  }
}
