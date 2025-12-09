# Voice Chat Application

## Prerequisites
- Node.js
- Redis

## How to Run

### 1. Start Redis
The application uses Redis for queue management and session storage.
```bash
redis-server
```

### 2. Start Backend
You can run a single server or multiple servers (for scalability).

**Single Instance:**
```bash
# In the root directory
npm start
``` 
*Runs on port 5000 by default.*

**Multiple Instances (Scaled Mode):**
```bash
# Terminal 1
PORT=5000 npm start

# Terminal 2
PORT=5001 npm start
```

### 3. Start Client
```bash
cd client
npm install # if not already installed
npm run dev
```
*The client runs on port 8080 by default: http://localhost:8080*
