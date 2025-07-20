// Simple WebSocket server for MCP avatar control
const WebSocket = require('ws');
const { ipcRenderer } = require('electron');

class AvatarController {
    constructor(port = 8765) {
        this.wss = new WebSocket.Server({ port });
        this.setupServer();
    }

    setupServer() {
        this.wss.on('connection', (ws) => {
            console.log('MCP client connected');
            
            ws.on('message', (message) => {
                try {
                    const command = JSON.parse(message);
                    this.handleCommand(command);
                } catch (error) {
                    console.error('Invalid command:', error);
                }
            });
            
            ws.on('close', () => {
                console.log('MCP client disconnected');
            });
        });
        
        console.log('Avatar control server running on port 8765');
    }
    
    handleCommand(command) {
        // Send command to renderer process
        if (global.mainWindow) {
            global.mainWindow.webContents.send('avatar-action', command);
        }
    }
}

// Export for use in main.js
module.exports = AvatarController;