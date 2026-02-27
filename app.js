// Boot Animation
window.addEventListener("load", function () {
    setTimeout(() => {
        const loader = document.getElementById('loader');
        const app = document.getElementById('app');

        loader.style.opacity = '0';

        setTimeout(() => {
            loader.style.display = 'none';
            document.body.style.overflow = 'auto';
            app.style.opacity = '1';

            const modules = document.querySelectorAll('.module');
            modules.forEach((mod) => mod.classList.add('loaded'));
        }, 500);

    }, 2500);
});

const MAX_V = 10.56;
const TOPIC_SET = "quad_opamps/voltage/set";
const TOPIC_STATE = "quad_opamps/voltage/state";
const TOPIC_REQUEST = "quad_opamps/voltage/request";

let client = null;
let isConnected = false;
let pendingPct = 0;

// ---------- MQTT ----------

function connect() {
    const broker = document.getElementById("broker").value.trim();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const clientId = document.getElementById("clientId").value.trim() || "quad_opamps_gui";

    if (!broker) {
        alert("Broker hostname required.");
        return;
    }

    const statusEl = document.getElementById("status");
    statusEl.textContent = "[ NEGOTIATING WSS LINK... ]";
    statusEl.style.color = "var(--amber-glow)";
    document.getElementById("connectBtn").disabled = true;

    try {
        const wsUrl = `wss://${broker}:8884/mqtt`;
        client = new Paho.MQTT.Client(wsUrl, clientId);

        client.onConnectionLost = () => updateStatus(false);
        client.onMessageArrived = onMessageArrived;

        client.connect({
            useSSL: true,
            userName: username,
            password: password,
            onSuccess: onConnect,
            onFailure: (err) => {
                statusEl.textContent = "[ FAIL: " + err.errorMessage + " ]";
                statusEl.style.color = "var(--red-glow)";
                document.getElementById("connectBtn").disabled = false;
            }
        });

    } catch (e) {
        alert("Connection error: " + e.message);
        document.getElementById("connectBtn").disabled = false;
    }
}

function onConnect() {
    updateStatus(true);
    client.subscribe(TOPIC_STATE);
    requestVoltage();
}

function requestVoltage() {
    if (!client || !isConnected) return;
    const msg = new Paho.MQTT.Message("get");
    msg.destinationName = TOPIC_REQUEST;
    client.send(msg);
}

function onMessageArrived(message) {

    if (guiMode === "transmit") {
        return;  // Ignore incoming state while transmitting
    }

    guiMode = "receive";

    if (message.destinationName === TOPIC_STATE) {
        const pct = parseInt(message.payloadString);
        const volts = (pct / 100) * MAX_V;

        document.getElementById("deviceState").textContent =
            `> TELEMETRY: ${pct}% // ${volts.toFixed(2)}V`;
    }

    setTimeout(() => {
        guiMode = "idle";
    }, 200);
}

function disconnect() {
    if (client) client.disconnect();
    updateStatus(false);
    document.getElementById("connectBtn").disabled = false;
}

function toggleConnect() {
    isConnected ? disconnect() : connect();
}

function updateStatus(connected) {
    isConnected = connected;
    const statusEl = document.getElementById("status");
    const btn = document.getElementById("connectBtn");
    const applyBtn = document.getElementById("applyBtn");

    if (connected) {
        statusEl.className = "status connected";
        statusEl.textContent = "[ LINK ACTIVE ]";
        btn.textContent = "TERMINATE LINK";
        applyBtn.disabled = false;
    } else {
        statusEl.className = "status disconnected";
        statusEl.textContent = "[ NO SIGNAL ]";
        btn.textContent = "INITIALIZE LINK";
        applyBtn.disabled = true;
    }
}

// ---------- Voltage UI ----------

function onSliderChange() {
    const pct = parseInt(document.getElementById("voltSlider").value);
    pendingPct = pct;
    updateVoltDisplay(pct);
}

function updateVoltDisplay(pct) {
    const volts = (pct / 100) * MAX_V;
    document.getElementById("voltDisplay").textContent = volts.toFixed(2);
    document.getElementById("pctLabel").textContent = pct + "%";
    document.getElementById("voltInput").value = volts.toFixed(2);
}

function applyVoltage() {
    if (!client || !isConnected) return;

    if (guiMode === "receive") return;

    guiMode = "transmit";

    const msg = new Paho.MQTT.Message(String(pendingPct));
    msg.destinationName = TOPIC_SET;
    client.send(msg);

    setTimeout(() => {
        guiMode = "idle";
    }, 500);  // small lock window
}

document.addEventListener("DOMContentLoaded", () => {
    updateVoltDisplay(0);
});