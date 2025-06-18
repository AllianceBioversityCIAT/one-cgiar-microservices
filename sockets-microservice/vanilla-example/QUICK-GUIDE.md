# Quick Guide - Socket.IO Rooms (5 minutes)

## What is this? 🤔

A **real-time room system** where multiple users can collaborate, but only **ONE user at a time** can edit the content.

## Key Concept 🎯

- **First user** to join = **EDITOR** ✏️ (can modify content)
- **Other users** = **OBSERVERS** 👀 (read-only)
- When editor leaves → Next user becomes editor

## Quick Test (2 minutes) ⚡

### 1. Start Here

1. Open `index.html` in your browser
2. Fill the form:
   - **Platform**: `room1` (leave as is)
   - **User ID**: `123` (or any number)
   - **Name**: `Your name`
3. Click **"Configure User"**

### 2. Go to a Room

1. Click **"Room 1 - Documents"**
2. You should see: **"✏️ You can EDIT"** (you're the editor!)
3. Type something in the big text area
4. Click **"Save Document"**

### 3. Test with Another User

1. Open **NEW TAB** (same browser)
2. Go to `index.html` again
3. Configure with:
   - **Platform**: `room1` (same as before)
   - **User ID**: `456` (different number)
   - **Name**: `Second User`
4. Go to **"Room 1 - Documents"**
5. You should see: **"👀 You can only OBSERVE"** (you're observer!)
6. The content from step 2 should appear automatically

## Understanding the Interface 📱

### Status Panel (top)

- **👤 Users in Room**: Shows all users and their roles
- **✏️ Your Permission Status**: Are you EDITOR or OBSERVER?

### Content Section (middle)

- **📝 Shared Document**: The collaborative content area
- **💾 Save Button**: Only works for editors
- **🔄 Refresh**: Get latest updates

### Events Section (bottom)

- **⚡ Custom Events**: Editors can send notifications
- **📊 Event Log**: Shows all activity in real-time

## Try These Tests 🧪

### Test 1: Permission Transfer

1. Close the **first tab** (the editor)
2. Go back to **second tab**
3. Refresh the page
4. Now you should be the **EDITOR**! ✏️

### Test 2: Different Rooms

1. Keep your current tab
2. Click **"Room 2 - Tasks"** at the bottom
3. This is a **different room** with different content
4. Each room works independently

### Test 3: Custom Events

1. As an editor, scroll to **"Custom Events"**
2. Change event ID to: `urgent-update`
3. Click **"Send Event"**
4. Check the **Event Log** below

## Common Issues & Solutions 🔧

### "Error joining room"

- **Solution**: Make sure server is running on port 3005
- **Check**: Browser console (F12) for connection errors

### "Platform is required"

- **Solution**: Fill the platform field on index.html
- **Note**: All users need same platform to interact

### Content not updating

- **Solution**: Click the **🔄 Refresh** button
- **Check**: Only editors can save content

### Can't edit anything

- **Normal**: You're an observer! Wait for editor to leave or check if there's actually an editor

## Advanced Tips 💡

### Multiple Users Testing

- Use **different browsers** (Chrome, Firefox, etc.)
- Or use **incognito/private** windows
- Each counts as a different user

### Platform System

- Think of **platform** as "app name"
- Users with different platforms **can't see each other**
- Use same platform = can collaborate

### Event System

- Events are like **notifications**
- Only **editors** can send them
- All users **receive** them instantly

## What's Next? 🚀

### For Developers

- Check `socket-client.js` for detailed API documentation
- Review `README.md` for technical implementation
- Server code is in the parent directory

### For Angular Users

- This vanilla example shows the **same concepts**
- All functions work identically in Angular
- Perfect for understanding before implementing

---

**🎉 That's it!** You now understand how the room system works. Try the different rooms and experiment with multiple users!

**Need more help?** Check the detailed `README.md` or review the code comments in `socket-client.js`.
