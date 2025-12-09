const io = require("socket.io-client");

const URL1 = "http://localhost:5000";
const URL2 = "http://localhost:5001";

const socket1 = io(URL1, { autoConnect: false });
const socket2 = io(URL2, { autoConnect: false });

let matched = false;

console.log("Starting verification test...");

socket1.on("connect", () => {
    console.log("Client 1 connected to Server 1 (5000)");
    socket1.emit("join-queue", { language: "english" });
});

socket2.on("connect", () => {
    console.log("Client 2 connected to Server 2 (5001)");
    socket2.emit("join-queue", { language: "english" });
});

socket1.on("match-found", (data) => {
    console.log("Client 1 found match:", data);
    if (matched) process.exit(0);
    matched = true;
});

socket2.on("match-found", (data) => {
    console.log("Client 2 found match:", data);
    if (matched) process.exit(0);
    matched = true;
});

// Start
socket1.connect();
setTimeout(() => {
    socket2.connect();
}, 500);

// Timeout
setTimeout(() => {
    console.error("Test Timed Out - No match found");
    process.exit(1);
}, 5000);
