// Socket.IO Client para manejo de salas
class SocketClient {
    constructor() {
        this.socket = null;
        this.currentRoom = null;
        this.platform = null;
        this.canEdit = false;
        this.users = [];
        this.roomData = {};
        this.isConnected = false;
    }

    connect(serverUrl = 'http://localhost:3005') {
        this.socket = io(serverUrl);

        this.socket.on('connect', () => {
            this.isConnected = true;
            console.log('Conectado al servidor:', this.socket.id);
            this.updateConnectionStatus('Conectado - ID: ' + this.socket.id);
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            console.log('Desconectado del servidor');
            this.updateConnectionStatus('Desconectado');
        });

        return this.socket;
    }

    configUser(name, userId, platform) {
        return new Promise((resolve) => {
            this.socket.emit('config-user', { name, userId, platform }, (response) => {
                if (response.ok) {
                    this.platform = platform;
                    console.log('Usuario configurado:', response);
                }
                resolve(response);
            });
        });
    }

    joinRoomWithPermissions(roomId, platform) {
        return new Promise((resolve) => {
            this.socket.emit('join-room-with-permissions', { roomId, platform }, (response) => {
                if (response.ok && response.room) {
                    this.currentRoom = roomId;
                    this.platform = platform;
                    this.updateRoomState(response.room);
                    console.log('Unido a la sala:', response);
                }
                resolve(response);
            });
        });
    }

    leaveRoomWithPermissions(roomId, platform) {
        return new Promise((resolve) => {
            this.socket.emit('leave-room-with-permissions', { roomId, platform }, (response) => {
                if (response.ok) {
                    this.currentRoom = null;
                    this.canEdit = false;
                    console.log('Salió de la sala:', response);
                }
                resolve(response);
            });
        });
    }

    updateRoomData(roomId, platform, data, eventId = null) {
        return new Promise((resolve) => {
            const payload = { roomId, platform, data };
            if (eventId) {
                payload.eventId = eventId;
            }

            this.socket.emit('update-room-data', payload, (response) => {
                console.log('Datos actualizados:', response);
                resolve(response);
            });
        });
    }

    getRoomInfo(roomId, platform) {
        return new Promise((resolve) => {
            this.socket.emit('get-room-info', { roomId, platform }, (response) => {
                if (response.ok && response.room) {
                    this.updateRoomState(response.room);
                }
                resolve(response);
            });
        });
    }

    // Escuchar eventos de la sala
    onRoomUpdated(platform, callback) {
        this.socket.on(`room-updated-${platform}`, (data) => {
            this.updateRoomState(data);
            if (callback) callback(data);
        });
    }

    onRoomEvent(platform, callback) {
        this.socket.on(`room-event-${platform}`, (event) => {
            console.log('Evento de sala recibido:', event);
            if (callback) callback(event);
        });
    }

    // Actualizar estado interno
    updateRoomState(roomData) {
        this.users = roomData.users || [];
        this.roomData = roomData.data || {};

        // Encontrar si el usuario actual puede editar
        const currentUser = this.users.find(user => user.socketId === this.socket.id);
        this.canEdit = currentUser ? currentUser.canEdit : false;
    }

    // Utilidades
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('socketStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    getCurrentUser() {
        return this.users.find(user => user.socketId === this.socket.id);
    }

    getUsers() {
        return this.users;
    }

    canUserEdit() {
        return this.canEdit;
    }

    getRoomData() {
        return this.roomData;
    }
}

// Instancia global del cliente
window.socketClient = new SocketClient(); 