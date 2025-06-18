# Sistema de Salas con Permisos - Socket.IO Microservice

## Descripción General

Este microservicio ha sido extendido con una funcionalidad completa de **salas con permisos de edición**. El sistema permite que múltiples usuarios se conecten a una sala, pero solo el **primer usuario que entra** tiene permisos de edición, mientras que los demás usuarios son **observadores**.

## Características Principales

- ✅ **Permisos de Edición**: Solo el primer usuario puede editar
- ✅ **Gestión Automática**: Cuando el editor se va, el siguiente usuario obtiene permisos
- ✅ **Eventos de Cambios**: Sistema de eventos para notificar cambios al frontend
- ✅ **Datos Opcionales**: Cada sala puede tener datos customizados
- ✅ **Compatibilidad**: Mantiene toda la funcionalidad existente

## Estructura de Datos

### RoomUser

```typescript
interface RoomUser {
  socketId: string;
  userId?: number;
  name: string;
  platform: string;
  canEdit: boolean;
  joinedAt: Date;
}
```

### RoomData

```typescript
interface RoomData {
  [key: string]: string | number | boolean | object | null | undefined;
}
```

### Room Response

```typescript
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
```

## Eventos Disponibles

### 1. `join-room-with-permissions`

Permite a un usuario unirse a una sala con gestión de permisos.

**Payload:**

```javascript
{
  roomId: "sala-123",
  platform: "mi-plataforma"
}
```

**Callback Response:**

```javascript
{
  ok: true,
  message: "Successfully joined room with permissions",
  room: {
    roomId: "sala-123",
    users: [
      {
        socketId: "socket-id-1",
        userId: 123,
        name: "Usuario 1",
        canEdit: true
      }
    ],
    data: {},
    lastEventId: ""
  }
}
```

### 2. `leave-room-with-permissions`

Permite a un usuario salir de una sala.

**Payload:**

```javascript
{
  roomId: "sala-123",
  platform: "mi-plataforma"
}
```

### 3. `update-room-data`

Actualiza los datos de una sala (solo el usuario con permisos puede hacerlo).

**Payload:**

```javascript
{
  roomId: "sala-123",
  platform: "mi-plataforma",
  data: {
    title: "Mi documento",
    content: "Contenido del documento"
  },
  eventId: "document-changed" // Opcional
}
```

### 4. `get-room-info`

Obtiene información completa de una sala.

**Payload:**

```javascript
{
  roomId: "sala-123",
  platform: "mi-plataforma"
}
```

## Eventos que Escucha el Cliente

### 1. `room-updated-{platform}`

Se emite cuando la sala se actualiza (usuarios entran/salen, datos cambian).

```javascript
{
  roomId: "sala-123",
  users: [...],
  data: {...},
  lastEventId: "ultimo-evento"
}
```

### 2. `room-event-{platform}`

Se emite cuando hay un evento específico (cuando se proporciona `eventId`).

```javascript
{
  roomId: "sala-123",
  eventId: "document-changed",
  data: {...},
  timestamp: "2024-01-15T10:30:00.000Z"
}
```

## Implementación en Angular

### 1. Instalación

```bash
npm install socket.io-client
```

### 2. Servicio de Socket

```typescript
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RoomSocketService {
  private socket: Socket;
  private roomDataSubject = new BehaviorSubject<any>(null);
  private canEditSubject = new BehaviorSubject<boolean>(false);

  constructor() {
    this.socket = io('http://localhost:3005');
  }

  // Configurar usuario
  configUser(name: string, userId: number, platform: string): Promise<any> {
    return new Promise(resolve => {
      this.socket.emit('config-user', { name, userId, platform }, (response: any) => {
        resolve(response);
      });
    });
  }

  // Unirse a sala con permisos
  joinRoomWithPermissions(roomId: string, platform: string): Promise<any> {
    return new Promise(resolve => {
      this.socket.emit('join-room-with-permissions', { roomId, platform }, (response: any) => {
        if (response.ok && response.room) {
          this.roomDataSubject.next(response.room);
          this.canEditSubject.next(response.room.canEdit || false);
        }
        resolve(response);
      });
    });
  }

  // Salir de sala
  leaveRoomWithPermissions(roomId: string, platform: string): Promise<any> {
    return new Promise(resolve => {
      this.socket.emit('leave-room-with-permissions', { roomId, platform }, (response: any) => {
        resolve(response);
      });
    });
  }

  // Actualizar datos de sala
  updateRoomData(roomId: string, platform: string, data: any, eventId?: string): Promise<any> {
    return new Promise(resolve => {
      this.socket.emit('update-room-data', { roomId, platform, data, eventId }, (response: any) => {
        resolve(response);
      });
    });
  }

  // Escuchar actualizaciones de sala
  onRoomUpdated(platform: string): Observable<any> {
    return new Observable(observer => {
      this.socket.on(`room-updated-${platform}`, data => {
        this.roomDataSubject.next(data);
        observer.next(data);
      });
    });
  }

  // Escuchar eventos específicos
  onRoomEvent(platform: string): Observable<any> {
    return new Observable(observer => {
      this.socket.on(`room-event-${platform}`, data => {
        observer.next(data);
      });
    });
  }

  // Observables para el estado
  get roomData$(): Observable<any> {
    return this.roomDataSubject.asObservable();
  }

  get canEdit$(): Observable<boolean> {
    return this.canEditSubject.asObservable();
  }
}
```

### 3. Componente Angular

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RoomSocketService } from './room-socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-room',
  template: `
    <div class="room-container">
      <h2>Sala: {{ roomId }}</h2>

      <div class="users-list">
        <h3>Usuarios en la sala:</h3>
        <ul>
          <li *ngFor="let user of users">
            {{ user.name }}
            <span *ngIf="user.canEdit" class="editor-badge">✏️ Editor</span>
          </li>
        </ul>
      </div>

      <div class="room-content">
        <h3>Contenido de la sala:</h3>
        <textarea
          [(ngModel)]="roomContent"
          [disabled]="!canEdit"
          (ngModelChange)="onContentChange()"
          placeholder="Escribe aquí...">
        </textarea>

        <div *ngIf="!canEdit" class="read-only-message">
          Solo el editor puede modificar el contenido
        </div>
      </div>
    </div>
  `
})
export class RoomComponent implements OnInit, OnDestroy {
  roomId = 'sala-123';
  platform = 'mi-plataforma';
  users: any[] = [];
  canEdit = false;
  roomContent = '';

  private subscriptions: Subscription[] = [];

  constructor(private roomSocket: RoomSocketService) {}

  async ngOnInit() {
    // Configurar usuario
    await this.roomSocket.configUser('Mi Usuario', 123, this.platform);

    // Unirse a la sala
    const response = await this.roomSocket.joinRoomWithPermissions(this.roomId, this.platform);
    console.log('Joined room:', response);

    // Escuchar actualizaciones
    const roomUpdated$ = this.roomSocket.onRoomUpdated(this.platform).subscribe(data => {
      this.users = data.users || [];
      if (data.data?.content) {
        this.roomContent = data.data.content;
      }
    });

    // Escuchar permisos de edición
    const canEdit$ = this.roomSocket.canEdit$.subscribe(canEdit => {
      this.canEdit = canEdit;
    });

    // Escuchar eventos específicos
    const roomEvent$ = this.roomSocket.onRoomEvent(this.platform).subscribe(event => {
      console.log('Room event received:', event);
      if (event.eventId === 'content-changed') {
        // Hacer algo específico cuando el contenido cambia
        this.showNotification('El contenido fue actualizado');
      }
    });

    this.subscriptions.push(roomUpdated$, canEdit$, roomEvent$);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.roomSocket.leaveRoomWithPermissions(this.roomId, this.platform);
  }

  onContentChange() {
    if (this.canEdit) {
      // Actualizar con un pequeño delay para evitar spam
      setTimeout(() => {
        this.roomSocket.updateRoomData(
          this.roomId,
          this.platform,
          { content: this.roomContent },
          'content-changed'
        );
      }, 500);
    }
  }

  private showNotification(message: string) {
    // Implementar notificación
    console.log('Notification:', message);
  }
}
```

## Implementación en JavaScript Vanilla

### 1. Incluir Socket.IO

```html
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
```

### 2. Implementación básica

```javascript
// Conectar al servidor
const socket = io('http://localhost:3005');

// Variables globales
let roomId = 'sala-123';
let platform = 'mi-plataforma';
let canEdit = false;

// Configurar usuario
function configUser(name, userId, platform) {
  return new Promise(resolve => {
    socket.emit('config-user', { name, userId, platform }, response => {
      resolve(response);
    });
  });
}

// Unirse a sala
function joinRoom(roomId, platform) {
  return new Promise(resolve => {
    socket.emit('join-room-with-permissions', { roomId, platform }, response => {
      if (response.ok && response.room) {
        updateUI(response.room);
        canEdit = response.room.users.find(u => u.socketId === socket.id)?.canEdit || false;
        updateEditPermissions();
      }
      resolve(response);
    });
  });
}

// Actualizar datos
function updateRoomData(data, eventId) {
  socket.emit('update-room-data', { roomId, platform, data, eventId }, response => {
    console.log('Update response:', response);
  });
}

// Escuchar eventos
socket.on(`room-updated-${platform}`, data => {
  updateUI(data);
  // Verificar si mis permisos cambiaron
  const myUser = data.users.find(u => u.socketId === socket.id);
  canEdit = myUser?.canEdit || false;
  updateEditPermissions();
});

socket.on(`room-event-${platform}`, event => {
  console.log('Room event:', event);
  if (event.eventId === 'document-changed') {
    showNotification('El documento fue actualizado');
  }
});

// Funciones de UI
function updateUI(roomData) {
  // Actualizar lista de usuarios
  const usersList = document.getElementById('users-list');
  usersList.innerHTML = '';

  roomData.users.forEach(user => {
    const li = document.createElement('li');
    li.textContent = `${user.name} ${user.canEdit ? '✏️ Editor' : '👁️ Observador'}`;
    usersList.appendChild(li);
  });

  // Actualizar contenido
  if (roomData.data.content) {
    document.getElementById('content-textarea').value = roomData.data.content;
  }
}

function updateEditPermissions() {
  const textarea = document.getElementById('content-textarea');
  textarea.disabled = !canEdit;

  const message = document.getElementById('permissions-message');
  message.textContent = canEdit ? 'Puedes editar' : 'Solo puedes observar';
}

// Inicializar
async function init() {
  await configUser('Usuario', 123, platform);
  await joinRoom(roomId, platform);
}

// Manejar cambios en el textarea
document.getElementById('content-textarea').addEventListener('input', e => {
  if (canEdit) {
    clearTimeout(window.updateTimeout);
    window.updateTimeout = setTimeout(() => {
      updateRoomData({ content: e.target.value }, 'content-changed');
    }, 500);
  }
});

// Inicializar cuando la página cargue
document.addEventListener('DOMContentLoaded', init);
```

### 3. HTML básico

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Room System</title>
    <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  </head>
  <body>
    <div id="app">
      <h1>Sistema de Salas</h1>

      <div id="users-section">
        <h2>Usuarios en la sala:</h2>
        <ul id="users-list"></ul>
      </div>

      <div id="content-section">
        <h2>Contenido:</h2>
        <textarea id="content-textarea" rows="10" cols="50"></textarea>
        <p id="permissions-message"></p>
      </div>
    </div>

    <script src="room-client.js"></script>
  </body>
</html>
```

## Flujo de Trabajo

1. **Usuario se conecta**: Configurar usuario con `config-user`
2. **Unirse a sala**: Usar `join-room-with-permissions`
3. **Primer usuario**: Obtiene permisos de edición automáticamente
4. **Usuarios adicionales**: Entran como observadores
5. **Editar contenido**: Solo el editor puede usar `update-room-data`
6. **Editor se va**: El siguiente usuario obtiene permisos automáticamente
7. **Eventos**: Se notifica a todos los cambios vía `room-updated-{platform}` y `room-event-{platform}`

## Compatibilidad

- ✅ Mantiene toda la funcionalidad existente de notificaciones y alertas
- ✅ Los eventos originales `join-room` y `leave-room` siguen funcionando
- ✅ No afecta las conexiones actuales de otras plataformas

## Testing

Para probar la funcionalidad, puedes usar múltiples pestañas del navegador o diferentes dispositivos:

1. Abre la primera pestaña → Usuario obtiene permisos de edición
2. Abre la segunda pestaña → Usuario es observador
3. Cierra la primera pestaña → El segundo usuario obtiene permisos
4. Edita desde cualquier pestaña con permisos → Todos ven los cambios en tiempo real

## Consideraciones de Producción

- **Validación**: Siempre validar permisos en el servidor antes de aplicar cambios
- **Rate Limiting**: Implementar límites para evitar spam de actualizaciones
- **Persistencia**: Los datos de sala solo existen en memoria, considerar base de datos para persistencia
- **Escalabilidad**: Para múltiples servidores, usar Redis para sincronizar el estado de las salas
