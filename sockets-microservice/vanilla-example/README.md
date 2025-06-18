# Vanilla Example - Sistema de Salas Socket.IO

## Descripción

Este es un ejemplo funcional completo del sistema de salas con permisos implementado con HTML, CSS y JavaScript vanilla. Demuestra todas las funcionalidades del microservicio de salas.

## Estructura de Archivos

```
vanilla-example/
├── index.html          # Página principal con navegación
├── room1.html          # Sala 1
├── room2.html          # Sala 2
├── room3.html          # Sala 3
├── js/
│   └── socket-client.js # Cliente de Socket.IO
└── README.md           # Este archivo
```

## Cómo Usar

### 1. Iniciar el Servidor

Primero, asegúrate de que el microservicio esté corriendo:

```bash
# En la carpeta raíz del proyecto
npm start
```

El servidor debería estar corriendo en `http://localhost:3005`

### 2. Abrir el Ejemplo

Abre `index.html` en tu navegador web.

### 3. Configurar Usuario

1. Completa los campos de configuración:
   - **Nombre**: Tu nombre de usuario
   - **ID**: Un número único (se genera automáticamente)
   - **Plataforma**: El identificador de la plataforma (por defecto: "vanilla-example")
2. Haz clic en "Configurar Usuario"

### 4. Navegar a las Salas

- Haz clic en "Sala 1", "Sala 2" o "Sala 3"
- Cada sala es independiente y tiene su propio contenido

## Funcionalidades Disponibles

### En Cada Sala:

#### 📊 **Estado de la Sala**

- **Estado de conexión**: Muestra si estás conectado
- **Información de sala**: ID de sala y número de usuarios
- **Permisos**: Indica si puedes EDITAR o solo OBSERVAR

#### 👥 **Usuarios en la Sala**

- Lista de todos los usuarios conectados
- Indica quién es el editor (✏️) y quién es observador (👁️)

#### 📝 **Contenido de la Sala**

- Área de texto para escribir contenido
- Solo el editor puede modificar el contenido
- Botón "Guardar Contenido" para sincronizar cambios

#### 📡 **Eventos Personalizados**

- Campo para el ID del evento
- Área JSON para datos personalizados
- Botón "Enviar Evento a Todos" (solo editor)

#### 📋 **Log de Eventos**

- Muestra todos los eventos en tiempo real
- Incluye timestamps y datos del evento
- Botón para limpiar el log

## Ejemplos de Uso

### Probar Permisos de Edición:

1. Abre la Sala 1 en una pestaña → Serás el editor
2. Abre la Sala 1 en otra pestaña → Serás observador
3. Cierra la primera pestaña → El observador se convierte en editor

### Enviar Eventos Personalizados:

```json
{
  "message": "Hola a todos",
  "type": "announcement",
  "priority": "high"
}
```

### Probar Sincronización:

1. Escribe contenido en el textarea
2. Haz clic en "Guardar Contenido"
3. Ve a otra pestaña de la misma sala
4. El contenido aparecerá automáticamente

## Navegación

- **← Volver al Inicio**: Regresa a la página principal
- **Ir a Sala X**: Cambia entre salas manteniendo la configuración
- Los botones de navegación disabled están reservados para futuras funcionalidades

## Eventos de Socket.IO Utilizados

### Enviados por el Cliente:

- `config-user`: Configurar usuario
- `join-room-with-permissions`: Unirse a sala
- `leave-room-with-permissions`: Salir de sala
- `update-room-data`: Actualizar datos (solo editor)
- `get-room-info`: Obtener información de sala

### Recibidos del Servidor:

- `room-updated-{platform}`: Actualización de sala
- `room-event-{platform}`: Eventos personalizados

## Datos de Ejemplo por Sala

### Sala 1:

- Enfoque: Documentos generales
- Evento por defecto: "custom-event"
- JSON ejemplo: Información básica

### Sala 2:

- Enfoque: Tareas y actualizaciones
- Evento por defecto: "task-update"
- JSON ejemplo: Estados de tareas

### Sala 3:

- Enfoque: Anuncios y broadcasts
- Evento por defecto: "announcement"
- JSON ejemplo: Mensajes importantes

## Desarrollo y Debug

### Consola del Navegador

Abre las herramientas de desarrollador (F12) para ver:

- Logs de conexión/desconexión
- Eventos enviados y recibidos
- Errores de parsing JSON

### Logs Visuales

Cada sala tiene un log visual que muestra:

- Eventos en tiempo real
- Datos recibidos en formato JSON
- Timestamps de cada acción

## Personalización

### Cambiar el Servidor

Modifica `socket-client.js` línea de conexión:

```javascript
connect(serverUrl = 'http://localhost:3005') {
```

### Agregar Nuevas Salas

1. Copia cualquier `roomX.html`
2. Cambia el `roomId` en el script
3. Actualiza la navegación en `index.html`

## Consideraciones

- **Múltiples Pestañas**: Cada pestaña es un usuario diferente
- **Conexión**: Requiere que el servidor esté corriendo
- **Permisos**: Solo el primer usuario puede editar
- **Datos**: Los datos se pierden al cerrar todas las pestañas

## Próximas Funcionalidades

Los botones disabled en la navegación están reservados para:

- Sistema de Alertas
- Sistema de Notificaciones

Estas funcionalidades se implementarán en futuras versiones.
