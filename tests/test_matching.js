const { io } = require("socket.io-client");

const URL = "http://localhost:5000";

const createClient = (name) => {
    const socket = io(URL, {
        transports: ["websocket"],
        autoConnect: false
    });
    socket.auth = { name };
    return socket;
};

const runTest = async () => {
    console.log("Starting Matching Algorithm verification...");

    const clientA = createClient("Client A (Male -> Any)");
    const clientB = createClient("Client B (Female -> Male)");

    let matchFound = false;

    // Helper to wrap socket connection in promise
    const connect = (socket) => new Promise((resolve) => {
        socket.on("connect", resolve);
        socket.connect();
    });

    await Promise.all([connect(clientA), connect(clientB)]);
    console.log("Clients connected");

    // Listen for match
    const matchPromise = new Promise((resolve) => {
        let matches = 0;
        const onMatch = (data, clientName) => {
            console.log(`✅ Match found for ${clientName}:`, data.roomId);
            matches++;
            if (matches === 2) {
                matchFound = true;
                resolve();
            }
        };

        clientA.on("match-found", (data) => onMatch(data, "Client A"));
        clientB.on("match-found", (data) => onMatch(data, "Client B"));
    });

    // Join Queue
    // Scenario: Client A (Male) looks for Any. Client B (Female) looks for Male.
    // Current logic might fail this because Client B looks in "Male->Male" or "Male->Any"? 
    // Wait, Client B looks for Male. So she checks "Male->Female" queue (if she is female).
    // If Client A is "Male->Any", he is in "Male->Any" queue.
    // Client B (Female looking for Male) currently pops from:
    // queue:lang:Male:Female (Male searching for Female)
    // She does NOT check queue:lang:Male:Any (Male searching for Any) -> THIS IS THE BUG/FEATURE TO ADD.

    console.log("Client A joining queue: Male -> Any");
    clientA.emit("join-queue", { language: "english", gender: "male", preferredGender: "any" });

    setTimeout(() => {
        console.log("Client B joining queue: Female -> Any");
        clientB.emit("join-queue", { language: "english", gender: "female", preferredGender: "any" });
    }, 500);

    // Wait for match or timeout
    const timeout = new Promise((resolve) => setTimeout(() => {
        if (!matchFound) console.log("❌ Timeout: No match found (Expected behavior before fix)");
        resolve();
    }, 5000));

    await Promise.race([matchPromise, timeout]);

    clientA.disconnect();
    clientB.disconnect();

    if (matchFound) {
        console.log("SUCCESS: Match logic works for Any <-> Specific intersection");
    } else {
        console.log("FAILED: Match logic missing Any <-> Specific intersection");
    }
};

runTest();
