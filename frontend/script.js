const API_URL = "http://localhost:6868"; // Ensure this matches your backend port
let toolsArray = [];
let currentWorkerReqId = null;
let pollInterval = null;

// --- Navigation Logic ---
function showWorkerSection() {
    document.getElementById('worker-section').classList.remove('hidden');
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('storekeeper-dashboard').classList.add('hidden');
    clearInterval(pollInterval);
}

function showStorekeeperLogin() {
    document.getElementById('worker-section').classList.add('hidden');
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('storekeeper-dashboard').classList.add('hidden');
}

// --- Worker Logic ---
function addTool() {
    const input = document.getElementById('w-tool-input');
    const tool = input.value.trim();
    if (tool) {
        toolsArray.push(tool);
        renderTools();
        input.value = '';
        input.focus();
    }
}

function renderTools() {
    const list = document.getElementById('tool-list');
    list.innerHTML = toolsArray.map(t => `<li>${t}</li>`).join('');
}

async function submitRequest() {
    console.log("Attempting to submit request...");

    const name = document.getElementById('w-name').value;
    const course = document.getElementById('w-course').value;
    const supervisor = document.getElementById('w-supervisor').value;
    
    // UX FIX: If user typed a tool but didn't click 'Add', add it for them
    const pendingTool = document.getElementById('w-tool-input').value.trim();
    if (pendingTool) {
        toolsArray.push(pendingTool);
        document.getElementById('w-tool-input').value = '';
        renderTools();
    }

    if (!name || !course || !supervisor || toolsArray.length === 0) {
        alert("Please, fill all field and request a tool");
        return;
    }

    // UI Feedback: Show immediately
    const overlay = document.getElementById('worker-status-overlay');
    const statusMsg = document.getElementById('status-message');
    overlay.classList.remove('hidden');
    statusMsg.innerText = "Enviando...";
    statusMsg.style.color = "#333";

    try {
        const response = await fetch(`${API_URL}/submit_request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, course, supervisor, tools: toolsArray })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        console.log("Request Success:", data);
        currentWorkerReqId = data.id;

        statusMsg.innerText = "Request Sent";
        statusMsg.style.color = "var(--primary)";
        
        // Start polling
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(checkWorkerStatus, 2000);

    } catch (error) {
        console.error("Fetch error:", error);
        statusMsg.innerText = "failed to connect";
        statusMsg.style.color = "red";
        alert("could not connect to server, Check WiFi connection");
        // Hide overlay so they can try again
        setTimeout(() => overlay.classList.add('hidden'), 2000);
    }
}

async function checkWorkerStatus() {
    if(!currentWorkerReqId) return;
    try {
        const res = await fetch(`${API_URL}/check_status/${currentWorkerReqId}`);
        if (!res.ok) return;
        const data = await res.json();
        
        const statusMsg = document.getElementById('status-message');
        const loader = document.querySelector('.loader');
        const resetBtn = document.getElementById('reset-worker-btn');

        if (data.status === 'ready') {
            statusMsg.innerText = "YOUR ORDER IS READY";
            statusMsg.style.color = "var(--secondary)"; 
        } else if (data.status === 'fulfilled') {
            statusMsg.innerText = "ORDER RETIRED";
            statusMsg.style.color = "green";
            loader.style.display = 'none';
            resetBtn.classList.remove('hidden');
            clearInterval(pollInterval);
        }
    } catch (e) {
        console.log("Polling error", e);
    }
}

function resetWorker() {
    currentWorkerReqId = null;
    toolsArray = [];
    document.getElementById('w-name').value = '';
    document.getElementById('w-course').value = '';
    document.getElementById('w-supervisor').value = '';
    document.getElementById('w-tool-input').value = ''; // Clear pending input too
    renderTools();
    document.getElementById('worker-status-overlay').classList.add('hidden');
    document.querySelector('.loader').style.display = 'block';
    document.getElementById('reset-worker-btn').classList.add('hidden');
}

// --- Storekeeper Logic ---
function loginStorekeeper() {
    const pass = document.getElementById('sk-password').value;
    if (pass === "admin123") { 
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('storekeeper-dashboard').classList.remove('hidden');
        fetchRequests();
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(fetchRequests, 3000);
    } else {
        document.getElementById('login-error').innerText = "Invalid Password";
    }
}

function logoutStorekeeper() {
    clearInterval(pollInterval);
    document.getElementById('sk-password').value = '';
    showStorekeeperLogin();
}

async function fetchRequests() {
    try {
        const res = await fetch(`${API_URL}/get_requests`);
        if (!res.ok) throw new Error("Failed to fetch");
        const requests = await res.json();
        const container = document.getElementById('requests-grid');
        
        container.innerHTML = requests.map(req => `
            <div class="req-box ${req.status === 'ready' ? 'ready' : ''}">
                <h3>${req.name}</h3>
                <p><strong>Course:</strong> ${req.course}</p>
                <p><strong>Sup:</strong> ${req.supervisor}</p>
                <hr>
                <ul>${req.tools.map(t => `<li>${t}</li>`).join('')}</ul>
                <div class="req-actions">
                    ${req.status === 'pending' 
                    ? `<button class="btn-secondary" onclick="updateStatus('${req.id}', 'ready')">Call Worker</button>` 
                    : `<span style="color:var(--secondary); font-weight:bold; padding: 10px 0;">CALLED</span>`}
                    
                    <button class="btn-danger" onclick="updateStatus('${req.id}', 'fulfilled')">Clear</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error("Storekeeper fetch error:", error);
    }
}

async function updateStatus(id, status) {
    try {
        await fetch(`${API_URL}/update_status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status })
        });
        fetchRequests(); 
    } catch (e) {
        console.error("Update status error:", e);
    }
}
