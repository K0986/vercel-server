const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const app = express();

// Security headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Get port from environment variable
const PORT = process.env.PORT || 5000;

// Store the last command
let lastCommand = '';

// Create HTTP server
const server = process.env.VERCEL ? null : app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Create WebSocket server if not on Vercel
let wss = null;
if (!process.env.VERCEL) {
    wss = new WebSocket.Server({ 
        server,
        path: '/ws'
    });

    // WebSocket connection handling
    wss.on('connection', handleWebSocketConnection);
}

function handleWebSocketConnection(ws, req) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`New client connected from: ${clientIp}`);

    // Send initial state
    if (lastCommand) {
        ws.send(JSON.stringify({ command: lastCommand }));
    }

    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const command = message.toString();
            console.log('Received command:', command);
            lastCommand = command;

            // Broadcast to all connected clients
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ command: command }));
                }
            });
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({ error: 'Invalid command format' }));
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log(`Client disconnected: ${clientIp}`);
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientIp}:`, error);
    });
}

// HTTP endpoint for polling (fallback for Vercel)
app.get('/ws', (req, res) => {
    res.json({ command: lastCommand });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        version: '1.0.0',
        uptime: process.uptime(),
        environment: process.env.VERCEL ? 'vercel' : 'local'
    });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Export the Express API
module.exports = app; 