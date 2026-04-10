import { User } from './user';

export class UserList {
  private userList: User[] = [];

  public addUser(user: User) {
    this.userList.push(user);
    return user;
  }

  public configUser(socketId: string, name?: string, userId?: number, platform?: string) {
    const user = this.userList.find(user => user.socketId === socketId);
    if (user) {
      if (name !== undefined) user.name = name;
      if (userId !== undefined) user.userId = userId;
      if (platform !== undefined) user.platform = platform;
    }
  }

  public getSocketIdsByUserIds(
    userIds: string | string[],
    platform: string
  ): {
    socketIds: string | string[];
    users: User[];
  } {
    const users = this.userList.filter((user: User) => {
      return user.userId && user.platform === platform
        ? userIds.includes(user.userId.toString())
        : false;
    });

    return { socketIds: users.map(user => user.socketId), users };
  }

  getUsersBySocketIds(socketIds: string | string[], platform: string) {
    return this.userList.filter((user: User) => {
      return socketIds.includes(user.socketId) && user.platform === platform;
    });
  }

  public getListByPlatform(platform: string) {
    // return this.userList.filter(user => user.name !== 'nameless' && user.platform === platform);
    return this.userList.filter(user => user.platform === platform);
  }

  public getAllUsers() {
    return this.userList;
  }

  public getUser(socketId: string) {
    return this.userList.find(user => user.socketId === socketId);
  }

  public deleteUser(socketId: string) {
    const user = this.getUser(socketId);

    this.userList = this.userList.filter(user => user.socketId !== socketId);

    return user;
  }
}
