/**
 * 🚀 SOCKET CLIENT FOR ROOMS WITH PERMISSIONS SYSTEM
 * 
 * This client manages Socket.IO connections with room management and edit permissions.
 * Only the first user to join a room gets edit permissions.
 * 
 * RECOMMENDED USAGE FLOW:
 * STEP 1: Connect to server (automatic)
 * STEP 2: Configure user (configUser function)
 * STEP 3: Join room with permissions (joinRoomWithPermissions function)
 * STEP 4: Update data (updateRoomData function - only for editors)
 * STEP 5: Listen to events (room-updated and room-event)
 */

// Global variables
let socket;
let currentUserPlatform = '';
let currentUserId = null;
let currentUserName = '';
let isUserConfigured = false;

/**
 * ⚡ STEP 1: CONNECT TO SERVER
 * 
 * Automatically connects to the Socket.IO server when this file loads.
 * The connection is essential before performing any other operations.
 */
window.onload = function () {
    console.log('🔌 Initializing Socket.IO connection...');
    socket = io('http://localhost:3005');

    // Connection successful
    socket.on('connect', () => {
        console.log('✅ Connected to server - Socket ID:', socket.id);
        updateConnectionStatus('Connected - ID: ' + socket.id, 'success');
    });

    // Connection lost
    socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
        updateConnectionStatus('Disconnected', 'error');
    });

    // Connection error
    socket.on('connect_error', (error) => {
        console.error('💥 Connection error:', error);
        updateConnectionStatus('Connection Error: ' + error.message, 'error');
    });
};

/**
 * 👤 STEP 2: CONFIGURE USER (REQUIRED)
 * 
 * This function MUST be called before joining any room.
 * Sends user data to the server and validates the configuration.
 * 
 * @param {string} platform - Groups users who can interact (e.g., 'room1', 'documents')
 * @param {number|undefined} userId - Unique user identifier (optional)
 * @param {string} name - Display name in rooms (default: 'nameless')
 */
function configUser(platform, userId = undefined, name = 'nameless') {
    console.log('👤 Configuring user:', { platform, userId, name });

    if (!socket) {
        console.error('❌ Socket not initialized');
        return;
    }

    if (!platform) {
        console.error('❌ Platform is required');
        alert('Platform is required to configure user');
        return;
    }

    // Store user data globally
    currentUserPlatform = platform;
    currentUserId = userId;
    currentUserName = name;

    // Send configuration to server
    socket.emit('config-user', { name, userId, platform }, (response) => {
        if (response.ok) {
            console.log('✅ User configured successfully:', response);
            isUserConfigured = true;
            updateUserStatus(`✅ User configured: ${name} (${userId || 'no ID'}) - ${platform}`, 'success');
        } else {
            console.error('❌ User configuration error:', response);
            updateUserStatus(`❌ Error: ${response.message}`, 'error');
        }
    });
}

/**
 * 🏠 STEP 3: JOIN ROOM WITH PERMISSIONS
 * 
 * Join a room with permission management.
 * The first user gets edit permissions, others become observers.
 * 
 * @param {string} roomId - Room identifier (e.g., 'room1', 'documents-room')
 * @param {function} callback - Function to execute when response is received
 */
function joinRoomWithPermissions(roomId, callback = null) {
    console.log('🏠 Joining room with permissions:', roomId);

    if (!socket || !isUserConfigured) {
        console.error('❌ User not configured or socket not connected');
        if (callback) callback({ ok: false, message: 'User not configured' });
        return;
    }

    const payload = {
        roomId: roomId,
        platform: currentUserPlatform
    };

    socket.emit('join-room-with-permissions', payload, (response) => {
        console.log('🏠 Room join response:', response);

        if (response.ok) {
            console.log('✅ Successfully joined room:', response.room);
            // Setup event listeners for this room
            setupRoomEventListeners(roomId);
        } else {
            console.error('❌ Error joining room:', response.message);
        }

        if (callback) callback(response);
    });
}

/**
 * 🚪 LEAVE ROOM WITH PERMISSIONS
 * 
 * Leave a room and update permissions for remaining users.
 * If the editor leaves, the next user automatically gets edit permissions.
 * 
 * @param {string} roomId - Room identifier
 * @param {function} callback - Function to execute when response is received
 */
function leaveRoomWithPermissions(roomId, callback = null) {
    console.log('🚪 Leaving room:', roomId);

    if (!socket || !isUserConfigured) {
        console.error('❌ User not configured or socket not connected');
        if (callback) callback({ ok: false, message: 'User not configured' });
        return;
    }

    const payload = {
        roomId: roomId,
        platform: currentUserPlatform
    };

    socket.emit('leave-room-with-permissions', payload, (response) => {
        console.log('🚪 Room leave response:', response);

        if (callback) callback(response);
    });
}

/**
 * 📝 STEP 4: UPDATE ROOM DATA (EDITORS ONLY)
 * 
 * Update room content. Only users with edit permissions can use this function.
 * Observers will receive an error if they try to update.
 * 
 * @param {string} roomId - Room identifier
 * @param {object} data - Data to update in the room
 * @param {string} eventId - Optional event identifier for custom events
 * @param {function} callback - Function to execute when response is received
 */
function updateRoomData(roomId, data, eventId = null, callback = null) {
    console.log('📝 Updating room data:', { roomId, data, eventId });

    if (!socket || !isUserConfigured) {
        console.error('❌ User not configured or socket not connected');
        if (callback) callback({ ok: false, message: 'User not configured' });
        return;
    }

    const payload = {
        roomId: roomId,
        platform: currentUserPlatform,
        data: data
    };

    // Add event ID if provided
    if (eventId) {
        payload.eventId = eventId;
    }

    socket.emit('update-room-data', payload, (response) => {
        console.log('📝 Room data update response:', response);

        if (response.ok) {
            console.log('✅ Room data updated successfully');
        } else {
            console.error('❌ Error updating room data:', response.message);
        }

        if (callback) callback(response);
    });
}

/**
 * ℹ️ STEP 5: GET ROOM INFORMATION
 * 
 * Get current room information including users, data, and permissions.
 * 
 * @param {string} roomId - Room identifier
 * @param {function} callback - Function to execute when response is received
 */
function getRoomInfo(roomId, callback = null) {
    console.log('ℹ️ Getting room info:', roomId);

    if (!socket || !isUserConfigured) {
        console.error('❌ User not configured or socket not connected');
        if (callback) callback({ ok: false, message: 'User not configured' });
        return;
    }

    const payload = {
        roomId: roomId,
        platform: currentUserPlatform
    };

    socket.emit('get-room-info', payload, (response) => {
        console.log('ℹ️ Room info response:', response);

        if (callback) callback(response);
    });
}

/**
 * 🎧 CONFIGURE EVENT LISTENERS FOR ROOM
 * 
 * Set up listeners for room events. This function is called automatically
 * when joining a room but can be called manually if needed.
 * 
 * @param {string} roomId - Room identifier
 */
function setupRoomEventListeners(roomId) {
    console.log('🎧 Setting up event listeners for room:', roomId);

    if (!socket) {
        console.error('❌ Socket not initialized');
        return;
    }

    // General room update event
    const updateEventName = `room-updated-${currentUserPlatform}`;
    socket.off(updateEventName); // Remove previous listeners
    socket.on(updateEventName, (roomData) => {
        console.log('🔄 Room updated:', roomData);
        handleRoomUpdate(roomData);
    });

    // Specific event with eventId
    const eventEventName = `room-event-${currentUserPlatform}`;
    socket.off(eventEventName); // Remove previous listeners
    socket.on(eventEventName, (eventData) => {
        console.log('⚡ Room specific event:', eventData);
        handleRoomEvent(eventData);
    });
}

/**
 * 🔄 HANDLE ROOM UPDATE
 * 
 * This function is called when the room receives a general update.
 * Override this function in your HTML to handle updates according to your needs.
 * 
 * @param {object} roomData - Complete room data
 */
function handleRoomUpdate(roomData) {
    console.log('🔄 Processing room update:', roomData);

    // Update users in interface (if element exists)
    updateUsersDisplay(roomData.users);

    // Update room data (if element exists)
    updateRoomDataDisplay(roomData.data);

    // Update editor status (if element exists)
    updateEditorStatus(roomData);
}

/**
 * ⚡ HANDLE SPECIFIC ROOM EVENT
 * 
 * This function is called when the room receives a specific event with eventId.
 * Override this function in your HTML to handle specific events.
 * 
 * @param {object} eventData - Event data with eventId
 */
function handleRoomEvent(eventData) {
    console.log('⚡ Processing specific room event:', eventData);

    // Add event to log (if element exists)
    addEventToLog(eventData);
}

// UTILITY FUNCTIONS FOR INTERFACE UPDATES

/**
 * 👥 UPDATE USERS DISPLAY
 * Updates the users list in the interface
 */
function updateUsersDisplay(users) {
    const usersElement = document.getElementById('roomUsers');
    if (usersElement && users) {
        usersElement.innerHTML = users.map(user => {
            const permission = user.canEdit ? '✏️ EDITOR' : '👀 OBSERVER';
            return `<div><strong>${user.name}</strong> (${user.userId || 'no ID'}) - ${permission}</div>`;
        }).join('');
    }
}

/**
 * 📊 UPDATE ROOM DATA DISPLAY
 * Updates the room data in the interface
 */
function updateRoomDataDisplay(data) {
    const dataElement = document.getElementById('roomData');
    if (dataElement && data) {
        if (data.content) {
            dataElement.value = data.content;
        }
    }
}

/**
 * 🎛️ UPDATE EDITOR STATUS
 * Updates the editor status in the interface
 */
function updateEditorStatus(roomData) {
    const statusElement = document.getElementById('editorStatus');
    if (statusElement && roomData.users) {
        const currentUser = roomData.users.find(user => user.socketId === socket.id);
        if (currentUser && currentUser.canEdit) {
            statusElement.innerHTML = '<span style="color: green; font-weight: bold;">✏️ You can EDIT</span>';
        } else {
            statusElement.innerHTML = '<span style="color: orange; font-weight: bold;">👀 You can only OBSERVE</span>';
        }
    }
}

/**
 * 📝 ADD EVENT TO LOG
 * Adds an event to the events log
 */
function addEventToLog(eventData) {
    const logElement = document.getElementById('eventLog');
    if (logElement) {
        const eventTime = new Date(eventData.timestamp).toLocaleTimeString();
        const eventEntry = `<div><strong>[${eventTime}]</strong> Event: ${eventData.eventId}</div>`;
        logElement.innerHTML = eventEntry + logElement.innerHTML;
    }
}

/**
 * 🔗 UPDATE CONNECTION STATUS
 * Updates the connection status in the interface
 */
function updateConnectionStatus(message, type) {
    const statusElement = document.getElementById('socketStatus');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = type === 'success' ? 'status-success' : 'status-error';
    }
}

/**
 * 👤 UPDATE USER STATUS
 * Updates the user configuration status in the interface
 */
function updateUserStatus(message, type) {
    const statusElement = document.getElementById('userStatus');
    if (statusElement) {
        statusElement.innerHTML = `<span style="color: ${type === 'success' ? 'green' : 'red'}; font-weight: bold;">${message}</span>`;
    }
} 