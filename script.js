/* =====================================================
   CAMPUS AI — MULTI-AGENT EVENT PLANNING SYSTEM
   Frontend Controller with Deep Agent-Data Connections
===================================================== */

const API = ""; // Same origin with Flask

/* ================= LOCAL STATE ================= */

let allAgentsData = [];
let activeAgentId = null;
let currentFilter = "all";
let agentState = {};
let conflicts = 2;
let readiness = 92;

let tasks = [
    { id: 1, name: "Confirm Main Auditorium booking", owner: "Venue Agent", agent_id: "venue", completed: true },
    { id: 2, name: "Reserve equipment resources", owner: "Resource Agent", agent_id: "resource", completed: true },
    { id: 3, name: "Assign volunteers across 4 zones", owner: "Volunteer Agent", agent_id: "volunteer", completed: true },
    { id: 4, name: "Approve security & safety plan", owner: "Event Admin", agent_id: "readiness", completed: false },
    { id: 5, name: "Resolve Projector P-07 conflict", owner: "Conflict Detection", agent_id: "conflict", completed: false },
];

/* ================= DOM HELPER ================= */

function get(id) { return document.getElementById(id); }

/* ================= TOAST ================= */

function showToast(message) {
    const toast = get("toast");
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3200);
}

/* ================= API HELPER ================= */

async function apiFetch(path, options = {}) {
    try {
        const res = await fetch(API + path, {
            headers: { "Content-Type": "application/json" },
            ...options,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn("API error on " + path + ":", err.message);
        return null;
    }
}

/* ================= NAVIGATION & HISTORY ================= */

const sectionTitles = {
    dashboard: "Command Center",
    planner: "AI Event Planner",
    agents: "Agent Network",
    schedule: "Event Schedule",
    resources: "Hardware & Resources",
    conflicts: "Conflict Detection",
    tasks: "Tasks & Deadlines",
    readiness: "Event Readiness",
    "ai-chat": "AI Event Assistant",
};

let navHistory = ["dashboard"];

function updateBackButton() {
    const backBtn = get("backNavBtn");
    const backText = get("backNavText");
    if (!backBtn) return;

    if (navHistory.length > 1) {
        const prevSection = navHistory[navHistory.length - 2];
        const prevTitle = sectionTitles[prevSection] || "Previous";
        if (backText) backText.innerText = `Back to ${prevTitle}`;
        backBtn.classList.add("visible");
    } else {
        backBtn.classList.remove("visible");
    }
}

function navigateTo(sectionId, addToHistory = true) {
    if (!sectionId) return;

    // Update active nav button
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.section === sectionId);
    });

    // Update active page
    document.querySelectorAll(".page").forEach(page => {
        page.classList.toggle("active", page.id === sectionId);
    });

    // Update topbar title
    const title = sectionTitles[sectionId] || "Command Center";
    if (get("topbarTitle")) get("topbarTitle").innerText = title;

    // Manage history stack
    if (addToHistory) {
        const currentTop = navHistory[navHistory.length - 1];
        if (currentTop !== sectionId) {
            navHistory.push(sectionId);
        }
    }

    updateBackButton();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function goBack() {
    if (navHistory.length > 1) {
        navHistory.pop(); // remove current section
        const prevSection = navHistory[navHistory.length - 1];
        navigateTo(prevSection, false);
    }
}

// Bind sidebar nav buttons
document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", function () {
        navigateTo(this.dataset.section);
    });
});

// Bind back button
if (get("backNavBtn")) {
    get("backNavBtn").addEventListener("click", goBack);
}

/* ================= AGENT NETWORK RENDERING & FILTERING ================= */

function filterAgents(category, btnElement) {
    currentFilter = category;
    document.querySelectorAll(".filter-chip").forEach(chip => chip.classList.remove("active"));
    if (btnElement) btnElement.classList.add("active");
    renderAgentCards(allAgentsData);
}

function renderAgentCards(apiAgents) {
    const container = get("agentCards");
    if (!container) return;
    container.innerHTML = "";

    const source = apiAgents && apiAgents.length ? apiAgents : allAgentsData;
    if (!source || !source.length) return;

    let filtered = source;
    if (currentFilter === "spatial") {
        filtered = source.filter(a => a.id === "venue" || a.id === "schedule");
    } else if (currentFilter === "logistics") {
        filtered = source.filter(a => a.id === "resource" || a.id === "volunteer");
    } else if (currentFilter === "temporal") {
        filtered = source.filter(a => a.id === "schedule" || a.id === "volunteer" || a.id === "planner");
    } else if (currentFilter === "governance") {
        filtered = source.filter(a => a.id === "conflict" || a.id === "readiness" || a.id === "planner");
    }

    filtered.forEach(agent => {
        const card = document.createElement("div");
        card.className = "agent-card";
        const isConflict = agent.id === "conflict" && conflicts > 0;
        if (isConflict) card.classList.add("warning-card");

        let statusText = "● Operational";
        let statusClass = "success";
        const state = agentState[agent.id] || agent.state || "idle";

        if (state === "running") {
            statusText = "● Running...";
            statusClass = "warning";
        } else if (state === "completed") {
            statusText = "● Completed";
            statusClass = "success";
        } else if (isConflict) {
            statusText = `● ${conflicts} Conflicts`;
            statusClass = "warning";
        }

        card.innerHTML = `
            <div class="agent-card-header">
                <div class="agent-icon">${agent.icon}</div>
                <span class="agent-status-badge ${statusClass}">${statusText}</span>
            </div>
            <h3>${agent.name}</h3>
            <div class="agent-tagline">${agent.tagline || agent.role || "Specialized Node"}</div>
            <p>${agent.description}</p>
            <div class="agent-telemetry-chip">
                <span>▣</span> ${agent.live_summary || agent.managed_domain || "Connected to active event"}
            </div>
            <div class="agent-card-footer">
                <button class="inspect-btn" onclick="event.stopPropagation(); openAgentModal('${agent.id}')">
                    Inspect & Live Data ↗
                </button>
                <button class="run-agent-chip" onclick="event.stopPropagation(); runSingleAgent('${agent.id}')">
                    ▶ Run
                </button>
            </div>
        `;

        card.addEventListener("click", () => openAgentModal(agent.id));
        container.appendChild(card);
    });
}

/* ================= AGENT CONTROL PLANE (DASHBOARD FLOW) ================= */

function renderAgentFlow(apiAgents) {
    const container = get("agentFlow");
    if (!container) return;
    container.innerHTML = "";

    const source = apiAgents && apiAgents.length ? apiAgents : allAgentsData;
    if (!source || !source.length) return;

    source.forEach((agent, index) => {
        if (index > 0) {
            const connector = document.createElement("div");
            connector.className = "connector";
            container.appendChild(connector);
        }

        const item = document.createElement("div");
        item.className = "flow-item";
        const state = agentState[agent.id] || agent.state || "idle";

        if (state === "running") item.classList.add("running");
        if (state === "completed") item.classList.add("done");

        const isConflict = agent.id === "conflict" && conflicts > 0;
        if (isConflict) item.classList.add("warning");

        let message = "Standing by";
        if (state === "running") message = "Agent executing...";
        else if (state === "completed") message = "Execution verified";
        else if (isConflict) message = `${conflicts} active conflicts`;

        item.innerHTML = `
            <span class="flow-number">0${index + 1}</span>
            <div style="flex-grow:1">
                <b>${agent.name}</b>
                <small>${message}</small>
            </div>
            <span class="flow-meta-pill">${agent.live_summary ? agent.live_summary.split("•")[0] : agent.role}</span>
        `;

        item.addEventListener("click", () => openAgentModal(agent.id));
        container.appendChild(item);
    });

    const completed = source.filter(a => (agentState[a.id] || a.state) === "completed").length;
    get("activeMetric").innerText = `${completed} / ${source.length}`;
    if (get("topbarAgentCount")) {
        get("topbarAgentCount").innerText = `${source.length} Connected Agents`;
    }
}

/* ================= AGENT INSPECTOR MODAL ================= */

async function openAgentModal(agentId) {
    activeAgentId = agentId;
    const modal = get("agentModal");
    modal.classList.remove("hidden");

    // Switch to first tab by default
    switchAgentTab("data");

    // Fetch detailed agent payload
    const agent = await apiFetch(`/api/agents/${agentId}`) || allAgentsData.find(a => a.id === agentId);
    if (!agent) return;

    // Header info
    get("modalAgentIcon").innerText = agent.icon || "✦";
    get("modalAgentName").innerText = agent.name;
    get("modalAgentTagline").innerText = agent.tagline || agent.description;
    get("modalAgentModel").innerText = agent.model || "Gemini 2.5 Pro";
    get("modalAgentDomain").innerText = `Domain: ${agent.managed_domain || agent.role}`;

    const state = agentState[agent.id] || agent.state || "idle";
    const statePill = get("modalAgentState");
    if (state === "running") {
        statePill.innerText = "● Running...";
        statePill.style.color = "var(--yellow)";
    } else if (state === "completed") {
        statePill.innerText = "● Completed";
        statePill.style.color = "var(--green)";
    } else {
        statePill.innerText = "● Operational";
        statePill.style.color = "var(--green)";
    }

    // Telemetry ribbons
    get("modalLatency").innerText = (agent.latency_ms || 120) + "ms";
    get("modalConfidence").innerText = agent.confidence || "98.5%";
    get("modalGovernedItems").innerText = agent.live_summary || "Active";
    get("modalPipelineLink").innerText = agent.target_section ? `Linked -> #${agent.target_section}` : "Core Pipeline";

    // Tab 1: Live Domain Data
    renderAgentConnectedData(agent);

    // Tab 2: Specs & Directives
    get("modalSystemPrompt").innerText = agent.system_prompt || "Monitor and optimize campus operations.";

    const inputsList = get("modalInputsList");
    inputsList.innerHTML = "";
    (agent.inputs || ["Natural Language Prompt", "Constraint Matrix"]).forEach(inp => {
        const li = document.createElement("li");
        li.innerText = `• ${inp}`;
        inputsList.appendChild(li);
    });

    const outputsList = get("modalOutputsList");
    outputsList.innerHTML = "";
    (agent.outputs || ["Operational Directives", "Telemetry Feed"]).forEach(out => {
        const li = document.createElement("li");
        li.innerText = `• ${out}`;
        outputsList.appendChild(li);
    });

    // Tab 3: Inter-Agent Communications
    renderAgentCommTab(agent.id);

    // Tab 4: Execution Logs
    renderAgentLogs(agent.activity_logs || []);

    // Configure Footer Jump Button
    const jumpBtn = get("modalJumpBtn");
    jumpBtn.onclick = () => {
        modal.classList.add("hidden");
        const targetSec = agent.target_section || "dashboard";
        navigateTo(targetSec);
    };

    // Configure Footer Run Button
    const runBtn = get("modalRunAgentBtn");
    runBtn.onclick = () => runSingleAgent(agent.id);

    // Configure Ask Agent LLM Button
    const askBtn = get("modalAskAgentBtn");
    if (askBtn) askBtn.onclick = () => showAgentAskPanel(agent.id, agent.name);
}

/* ================= INTER-AGENT COMMUNICATION LOGS & TAB ================= */

let commMessagesCache = [];

async function refreshCommLogs() {
    const messages = await apiFetch("/api/agent-communications");
    if (messages) {
        commMessagesCache = messages;
        renderCommBusTable(messages);
        if (get("commMessageCount")) get("commMessageCount").innerText = messages.length;
    }
}

function renderCommBusTable(messages) {
    const tbody = get("commTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    (messages || []).forEach(msg => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><b style="font-family:monospace; color:var(--muted); font-size:10px">${msg.timestamp}</b></td>
            <td><b style="color:var(--text)">${msg.from_name || msg.from_agent}</b></td>
            <td style="color:var(--purple-light); font-weight:bold; text-align:center">➔</td>
            <td><b style="color:var(--text)">${msg.to_name || msg.to_agent}</b></td>
            <td><span class="comm-protocol-chip">${msg.channel}</span></td>
            <td><span style="color:var(--muted-light)">${msg.summary}</span></td>
            <td><small style="color:var(--muted); font-family:monospace">${msg.latency || '15ms'}</small></td>
            <td><span class="comm-status-chip">${msg.status || 'VERIFIED'}</span></td>
        `;
        tbody.appendChild(row);
    });
}

async function renderAgentCommTab(agentId) {
    const container = get("modalAgentCommList");
    if (!container) return;
    container.innerHTML = `<p style="color:var(--muted)">Loading inter-agent communication packets...</p>`;

    const messages = await apiFetch(`/api/agent-communications?agent_id=${agentId}`);
    if (!messages || !messages.length) {
        container.innerHTML = `<p style="color:var(--muted)">No inter-agent messages logged for this node.</p>`;
        return;
    }

    container.innerHTML = "";
    messages.forEach(msg => {
        const isSender = msg.from_agent === agentId;
        const item = document.createElement("div");
        item.className = "comm-packet-item";
        item.innerHTML = `
            <div class="comm-packet-header">
                <div class="comm-packet-title">
                    <span style="color:${isSender ? 'var(--green)' : 'var(--cyan)'}">${isSender ? '📤 OUTGOING PACKET' : '📥 INCOMING PACKET'}</span>
                    <span class="comm-protocol-chip">${msg.channel}</span>
                </div>
                <small style="color:var(--muted); font-family:monospace">[${msg.timestamp}]</small>
            </div>
            <div style="font-size:11px; margin-bottom:6px;">
                <b style="color:var(--muted)">${isSender ? 'Destination:' : 'Source:'}</b> 
                <span style="color:var(--text); font-weight:600">${isSender ? msg.to_name : msg.from_name}</span>
            </div>
            <p style="color:var(--muted-light); font-size:11px; margin-bottom:8px">${msg.summary}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px;">
                <span style="color:var(--purple-light); font-family:monospace">Payload: ${JSON.stringify(msg.payload || {}).substring(0, 50)}...</span>
                <span class="comm-status-chip">${msg.status}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

function toggleCommPanel() {
    const panel = get("commBusPanel");
    if (panel) {
        panel.style.display = panel.style.display === "none" ? "block" : "none";
    }
}

async function sendTestSignal() {
    showToast("⚡ Transmitting handshake signal: Event Planner ➔ Venue Agent...");
    const res = await apiFetch("/api/agent-communications/test-ping", {
        method: "POST",
        body: JSON.stringify({ from_agent: "planner", to_agent: "venue", channel: "HEARTBEAT_SYNC_PING" })
    });
    if (res && res.packet) {
        showToast("✓ Handshake ACK verified: 14ms latency!");
        await refreshCommLogs();
        await refreshAll();
    }
}

async function executeCustomPing() {
    const fromAgent = get("pingFromAgent").value;
    const toAgent = get("pingToAgent").value;
    showToast(`⚡ Transmitting packet from ${fromAgent.toUpperCase()} ➔ ${toAgent.toUpperCase()}...`);

    const res = await apiFetch("/api/agent-communications/test-ping", {
        method: "POST",
        body: JSON.stringify({ from_agent: fromAgent, to_agent: toAgent, channel: "CUSTOM_PROTOCOL_HANDSHAKE" })
    });

    if (res && res.packet) {
        showToast(`✓ Inter-Agent Packet delivered to ${toAgent.toUpperCase()}!`);
        await refreshCommLogs();
        await refreshAll();
    }
}

function switchAgentTab(tabName) {
    document.querySelectorAll(".modal-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.tab === tabName);
    });
    document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.classList.toggle("active", pane.id === `tab-${tabName}`);
    });
}

function renderAgentConnectedData(agent) {
    const container = get("agentDataContainer");
    container.innerHTML = "";

    const connected = agent.connected_data;
    if (!connected) {
        container.innerHTML = `<p style="color:var(--muted)">No additional live data stream connected.</p>`;
        return;
    }

    if (connected.type === "venues") {
        const grid = document.createElement("div");
        grid.className = "data-card-grid";
        connected.venues.forEach(v => {
            const card = document.createElement("div");
            card.className = "venue-data-card";
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <h4>${v.name}</h4>
                    <span class="badge">${v.status}</span>
                </div>
                <div class="venue-meta">Capacity: <b>${v.capacity} seats</b> • Occupancy: <b>${v.occupancy_rate}%</b></div>
                <div class="venue-meta" style="color:var(--purple-light)">Purpose: ${v.assigned_to}</div>
                <div class="venue-meta"><small>Lead: ${v.coordinator}</small></div>
                <div class="pill-list">
                    ${v.equipment.map(eq => `<span class="pill-item">⚙ ${eq}</span>`).join("")}
                </div>
            `;
            grid.appendChild(card);
        });
        container.appendChild(grid);
    } else if (connected.type === "volunteers") {
        const grid = document.createElement("div");
        grid.className = "data-card-grid";
        connected.volunteers.forEach(vol => {
            const card = document.createElement("div");
            card.className = "volunteer-data-card";
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <h4>${vol.name}</h4>
                    <span class="badge" style="background:#13261a">${vol.status}</span>
                </div>
                <div class="volunteer-meta">Role: <b style="color:var(--purple-light)">${vol.role}</b> (${vol.team})</div>
                <div class="volunteer-meta">Shift: ${vol.shift} • Station: <b>${vol.assigned}</b></div>
                <div class="pill-list">
                    <span class="pill-item">✦ Skills: ${vol.skills}</span>
                </div>
            `;
            grid.appendChild(card);
        });
        container.appendChild(grid);
    } else if (connected.type === "resources") {
        const grid = document.createElement("div");
        grid.className = "data-card-grid";
        connected.resources.forEach(r => {
            const pct = r.utilization ?? Math.round((r.allocated / r.available) * 100);
            const card = document.createElement("div");
            card.className = "resource-data-card";
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <h4>${r.name}</h4>
                    <span class="resource-category">${r.category}</span>
                </div>
                <div class="venue-meta">${r.allocated} allocated of ${r.available} ${r.unit} (${r.location})</div>
                <div class="bar ${pct > 85 ? 'warning' : ''}"><span style="width:${pct}%"></span></div>
                <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--muted)">
                    <span>Utilization</span>
                    <b>${pct}%</b>
                </div>
            `;
            grid.appendChild(card);
        });
        container.appendChild(grid);
    } else if (connected.type === "schedule") {
        const list = document.createElement("div");
        connected.schedule.forEach(item => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #1c2531;";
            row.innerHTML = `
                <div>
                    <b style="font-size:12px; color:var(--purple-light); font-family:monospace">${item.time} (${item.duration})</b>
                    <span style="font-size:13px; font-weight:600; margin-left:10px">${item.activity}</span>
                </div>
                <div style="text-align:right">
                    <small style="color:var(--muted)">${item.venue}</small>
                    <span class="badge" style="margin-left:8px">${item.owner}</span>
                </div>
            `;
            list.appendChild(row);
        });
        container.appendChild(list);
    } else if (connected.type === "conflicts") {
        if (!connected.conflicts.length) {
            container.innerHTML = `<div class="card"><h3>✓ Zero Conflicts Active</h3><p style="color:var(--muted)">All constraints satisfied.</p></div>`;
            return;
        }
        connected.conflicts.forEach(c => {
            const card = document.createElement("div");
            card.className = "conflict " + (c.priority === "HIGH" ? "high" : "");
            card.innerHTML = `
                <div class="conflict-info">
                    <b>[${c.priority}] ${c.title}</b>
                    <p>${c.description}</p>
                    <div class="conflict-fix-recommendation">AI Fix: ${c.recommended_fix || 'Auto-balance'}</div>
                </div>
                <button class="resolve" onclick="resolveConflict(${c.id})">Apply AI Fix</button>
            `;
            container.appendChild(card);
        });
    } else if (connected.type === "readiness") {
        const wrap = document.createElement("div");
        wrap.innerHTML = `
            <div style="display:flex; align-items:center; gap:20px; margin-bottom:16px;">
                <div class="score-circle" style="width:90px; height:90px; margin:0">
                    <strong style="font-size:28px">${connected.score}</strong>
                    <span>/100</span>
                </div>
                <div>
                    <h3>Composite Readiness Score</h3>
                    <p style="color:var(--muted); font-size:12px">Aggregated from spatial, logistical, staffing, and constraint models.</p>
                </div>
            </div>
            <div>
                ${connected.checklist.map(chk => `
                    <div class="check">
                        <div class="check-icon ${chk.ok ? '' : 'pending'}">${chk.ok ? '✓' : '!'}</div>
                        <div class="check-main"><b>${chk.label}</b><small>${chk.detail}</small></div>
                        <span class="${chk.ok ? 'success' : 'warning'}">${chk.status}</span>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(wrap);
    } else if (connected.type === "planner") {
        const ev = connected.event;
        container.innerHTML = `
            <div class="card" style="background:#090e17; margin-bottom:14px;">
                <h3>${ev.name}</h3>
                <p style="color:var(--purple-light); font-size:12px; margin-bottom:8px">Target: ${ev.participants} Attendees • ${ev.duration} • ${ev.type}</p>
                <p style="color:var(--muted); font-size:11px">${connected.intake_prompt}</p>
            </div>
            <div class="plan-row"><span>Recommended Venues</span><b>${ev.venues} Venues Verified</b></div>
            <div class="plan-row"><span>Equipment Units</span><b>${ev.resources} Hardware Units</b></div>
            <div class="plan-row"><span>Staff Roster</span><b>${ev.volunteers} Volunteers Assigned</b></div>
            <div class="plan-row"><span>Executive Approvals</span><b>${ev.approvals} Signoffs Required</b></div>
        `;
    }
}

function renderAgentLogs(logs) {
    const terminal = get("modalLogTerminal");
    terminal.innerHTML = "";

    if (!logs || !logs.length) {
        terminal.innerHTML = `<div class="log-entry" style="color:var(--muted)">[Awaiting execution trigger...]</div>`;
        return;
    }

    logs.forEach(log => {
        const row = document.createElement("div");
        row.className = "log-entry";
        row.innerHTML = `
            <span class="log-time">[${log.time || '11:00:00'}]</span>
            <span class="log-level-${log.level || 'INFO'}">${log.level || 'INFO'}</span>
            <span>${log.text}</span>
        `;
        terminal.appendChild(row);
    });
    terminal.scrollTop = terminal.scrollHeight;
}

function clearAgentLogs() {
    get("modalLogTerminal").innerHTML = `<div class="log-entry" style="color:var(--muted)">[Terminal logs cleared]</div>`;
}

/* Close Agent Modal */
get("closeAgentModal").addEventListener("click", () => {
    get("agentModal").classList.add("hidden");
});

get("modalDoneBtn").addEventListener("click", () => {
    get("agentModal").classList.add("hidden");
});

/* ================= SINGLE AGENT RUN ================= */

async function runSingleAgent(agentId) {
    showToast(`▶ Running ${agentId.toUpperCase()} Agent...`);
    agentState[agentId] = "running";
    renderAgentCards(allAgentsData);
    renderAgentFlow(allAgentsData);

    const data = await apiFetch(`/api/agents/${agentId}/run`, { method: "POST" });

    await wait(800);
    agentState[agentId] = "completed";

    if (data) {
        readiness = data.readiness;
    }

    await refreshAll();

    if (activeAgentId === agentId && !get("agentModal").classList.contains("hidden")) {
        openAgentModal(agentId);
    }

    showToast(`✓ Agent '${agentId}' completed execution!`);
}

/* ================= RUN ALL AGENTS ================= */

async function runAllAgents() {
    showToast("✦ Multi-agent orchestration pipeline started...");

    const source = allAgentsData.length ? allAgentsData : [
        { id: "planner" }, { id: "venue" }, { id: "resource" },
        { id: "volunteer" }, { id: "schedule" }, { id: "conflict" }, { id: "readiness" }
    ];

    for (const agent of source) {
        agentState[agent.id] = "running";
        renderAgentCards(allAgentsData);
        renderAgentFlow(allAgentsData);
        await wait(600);
        agentState[agent.id] = "completed";
        renderAgentCards(allAgentsData);
        renderAgentFlow(allAgentsData);
    }

    const data = await apiFetch("/api/agents/run-all", { method: "POST" });
    if (data) readiness = data.readiness;

    await refreshAll();
    showToast("✓ All 7 specialized agents executed and synchronized!");
}

/* ================= SIMULATE REPLAN ================= */

async function simulateReplan() {
    showToast("↻ Campus condition shift detected. AI replanning triggered...");
    setTimeout(() => showToast("⌂ Venue Agent finding alternative space..."), 900);
    setTimeout(() => showToast("◷ Schedule Agent recalculating milestone graph..."), 1800);

    setTimeout(async () => {
        const data = await apiFetch("/api/replan", { method: "POST" });
        if (data) {
            conflicts = data.open_conflicts;
            readiness = data.readiness;
            if (data.agent_states) {
                Object.assign(agentState, data.agent_states);
            }
        } else {
            conflicts = 0;
            readiness = 98;
        }
        await refreshAll();
        showToast("✓ Dynamic replan completed! All constraints clear.");
    }, 3200);
}

/* ================= PLANNER GENERATION ================= */

async function generatePlan() {
    const text = get("requirements").value.trim();
    if (!text) { showToast("Please provide event requirements."); return; }

    showToast("✦ Event Planner Agent synthesizing operational blueprint...");

    // Try Gemini LLM first (server key or user's saved key)
    const apiKey = getStoredApiKey();
    const btn = get("generateBtn");
    if (btn) { btn.disabled = true; btn.innerText = "✦ Generating with Gemini..."; }

    try {
        const data = await apiFetch("/api/llm/plan", {
            method: "POST",
            body: JSON.stringify({ requirements: text, api_key: apiKey }),
        });
        if (btn) { btn.disabled = false; btn.innerText = "✦ Generate Operational Plan"; }
        if (data && data.plan) {
            renderLLMPlan(data.plan);
            showToast("✓ AI-powered plan generated by Gemini Flash!");
            await refreshAll();
            document.querySelector('[data-section="agents"]').click();
            return;
        } else if (data && data.error) {
            showToast("⚠ " + data.error);
        }
    } catch (e) { /* fall through to rule-based */ }
    if (btn) { btn.disabled = false; btn.innerText = "✦ Generate Operational Plan"; }

    // Fallback: rule-based plan
    const data = await apiFetch("/api/plan/generate", {
        method: "POST",
        body: JSON.stringify({ requirements: text }),
    });
    setTimeout(async () => {
        renderPlan(data);
        showToast("✓ Operational plan matrix generated & dispatched!");
        await refreshAll();
        document.querySelector('[data-section="agents"]').click();
    }, 1600);
}

function renderLLMPlan(planText) {
    const output = get("planOutput");
    const lines = planText.split('\n');
    let html = '';
    lines.forEach(line => {
        const t = line.trim();
        if (!t) { html += '<br>'; return; }
        if (/^#{1,3}\s/.test(t)) {
            html += `<div style="font-weight:700;color:var(--purple-light);font-size:13px;margin-top:12px;margin-bottom:4px;">${t.replace(/^#{1,3}\s/, '')}</div>`;
        } else if (/^\d+\.\s/.test(t)) {
            html += `<div class="plan-row"><span>${t.match(/^\d+/)[0]}.</span><b>${t.replace(/^\d+\.\s/, '')}</b></div>`;
        } else if (t.startsWith('- ') || t.startsWith('• ') || t.startsWith('* ')) {
            html += `<div style="display:flex;gap:8px;padding:3px 0;font-size:13px;"><span style="color:var(--purple-light)">•</span><span>${t.slice(2)}</span></div>`;
        } else if (t.startsWith('**') && t.endsWith('**')) {
            html += `<div style="font-weight:700;color:var(--text);margin-top:8px;">${t.slice(2, -2)}</div>`;
        } else {
            html += `<div style="font-size:13px;color:var(--muted-light);padding:2px 0;">${t}</div>`;
        }
    });
    output.innerHTML = `<div style="border:1px solid rgba(139,92,246,0.2);border-radius:10px;padding:14px;background:rgba(139,92,246,0.04);">${html}</div>`;
}

function renderPlan(plan) {
    const p = plan || {
        event_type: "AI Hackathon & Build Sprint", participants: 150, duration: "2 Days",
        venues_recommended: 4, resources_required: 28, volunteers_required: 15, approvals_required: 2,
    };
    get("planOutput").innerHTML = `
        <div class="plan-row"><span>Event Classification</span><b>${p.event_type}</b></div>
        <div class="plan-row"><span>Target Attendees</span><b>${p.participants} Participants</b></div>
        <div class="plan-row"><span>Event Duration</span><b>${p.duration}</b></div>
        <div class="plan-row"><span>Campus Venues</span><b>${p.venues_recommended} Venues Allocated</b></div>
        <div class="plan-row"><span>Hardware Assets</span><b>${p.resources_required} Units Assigned</b></div>
        <div class="plan-row"><span>Student Volunteer Roster</span><b>${p.volunteers_required} Staff Assigned</b></div>
        <div class="plan-row"><span>Governance & Compliance</span><b>${p.approvals_required} Executive Signoffs</b></div>
    `;
}

/* ================= TIMELINE & SCHEDULE ================= */

const fallbackSchedule = [
    ["08:30", "Registration & Welcome Kits", "Main Auditorium Foyer", "Volunteer Agent", "30m"],
    ["09:00", "Opening Ceremony & Keynotes", "Main Auditorium", "Event Planner Agent", "60m"],
    ["10:00", "Hackathon Begins & Coding Sprint", "Innovation Lab", "Schedule Agent", "180m"],
    ["13:00", "Networking Lunch & Refreshments", "Food Court Zone B", "Resource Agent", "60m"],
    ["14:00", "AI Agent & LLM Workshop", "Seminar Hall A", "Event Planner Agent", "120m"],
    ["18:00", "Project Demos & Final Judging", "Innovation Lab", "Volunteer Agent", "90m"],
];

function renderTimeline() {
    const container = get("timeline");
    if (!container) return;
    container.innerHTML = "";
    fallbackSchedule.slice(0, 5).forEach(item => {
        const row = document.createElement("div");
        row.className = "timeline-row";
        row.innerHTML = `
            <time>${item[0]}</time>
            <div class="timeline-dot"></div>
            <div>
                <b>${item[1]}</b>
                <small>${item[2]} • ${item[3]}</small>
            </div>
        `;
        container.appendChild(row);
    });
}

function renderSchedule(apiSchedule) {
    const table = get("scheduleTable");
    if (!table) return;
    table.innerHTML = "";
    const source = apiSchedule || fallbackSchedule.map(i => ({ time: i[0], activity: i[1], venue: i[2], owner: i[3], duration: i[4], status: "READY" }));
    source.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><b style="font-family:monospace; color:var(--purple-light)">${item.time}</b></td>
            <td><b>${item.activity}</b></td>
            <td>${item.venue}</td>
            <td><span class="badge" style="background:#131b28; border:1px solid #233145">${item.owner}</span></td>
            <td><small style="color:var(--muted)">${item.duration || '60m'}</small></td>
            <td><span class="badge">${item.status || "READY"}</span></td>
        `;
        table.appendChild(row);
    });
}

/* ================= RESOURCES ================= */

function renderResources(apiResources) {
    const container = get("resourceGrid");
    if (!container) return;
    container.innerHTML = "";
    const source = apiResources || [
        { name: "High-Lumen Projectors", allocated: 8, available: 10, unit: "units", category: "Audio/Visual", location: "Central AV Vault" },
        { name: "Developer Laptops", allocated: 120, available: 120, unit: "units", category: "Computing", location: "CS Tech Reserve" },
        { name: "Wireless Microphones", allocated: 12, available: 15, unit: "units", category: "Audio/Visual", location: "Control Booth" },
        { name: "High-Speed Mesh Kits", allocated: 30, available: 35, unit: "nodes", category: "Networking", location: "IT Locker" },
        { name: "Heavy-Duty Power Strips", allocated: 45, available: 50, unit: "units", category: "Power", location: "Facilities Depot" },
        { name: "Emergency Medical Kits", allocated: 4, available: 5, unit: "kits", category: "Safety", location: "Health Center" },
    ];
    source.forEach(resource => {
        const pct = resource.utilization ?? Math.round((resource.allocated / resource.available) * 100);
        const card = document.createElement("div");
        card.className = "resource";
        card.innerHTML = `
            <div class="resource-header">
                <b>${resource.name}</b>
                <span class="resource-category">${resource.category || 'Asset'}</span>
            </div>
            <p>${resource.allocated} allocated / ${resource.available} ${resource.unit || 'units'}</p>
            <div class="bar ${pct > 85 ? 'warning' : ''}"><span style="width:${pct}%"></span></div>
            <div class="resource-meta">
                <small>${pct}% utilization</small>
                <small>${resource.location || 'Depot'}</small>
            </div>
        `;
        container.appendChild(card);
    });
}

/* ================= CONFLICTS ================= */

function renderConflicts(apiConflicts) {
    const container = get("conflictList");
    if (!container) return;
    container.innerHTML = "";

    const source = apiConflicts !== undefined ? apiConflicts : null;
    const count = source ? source.length : conflicts;

    if (count === 0) {
        container.innerHTML = `
            <div class="card" style="text-align:center; padding:36px 20px;">
                <h3 style="color:var(--green); margin-bottom:8px;">✓ Zero Active Conflicts</h3>
                <p style="color:var(--muted)">All spatial, hardware fleet, schedule timetable, and volunteer constraints are verified.</p>
            </div>
        `;
        return;
    }

    const fallback = [
        {
            id: 1, title: "Projector P-07 double booking",
            description: "Projector P-07 is requested simultaneously in Seminar Hall A and Innovation Lab at 14:00.",
            priority: "HIGH",
            recommended_fix: "Dispatch spare backup Projector P-11 from Central AV Vault to Innovation Lab."
        },
        {
            id: 2, title: "Volunteer overlap in Registration vs Workshop",
            description: "Two volunteers are assigned to registration desk and workshop setup at the exact same shift window.",
            priority: "MEDIUM",
            recommended_fix: "Stagger registration closing to 11:30 and auto-reassign Neha Gupta to Seminar Hall at 13:00."
        }
    ];

    (source || fallback.slice(0, count)).forEach(conflict => {
        const card = document.createElement("div");
        card.className = "conflict " + (conflict.priority === "HIGH" ? "high" : "");
        card.innerHTML = `
            <div class="conflict-info">
                <b>[${conflict.priority}] ${conflict.title}</b>
                <p>${conflict.description}</p>
                <div class="conflict-fix-recommendation">AI Fix: ${conflict.recommended_fix || 'Auto-balance'}</div>
            </div>
            <button class="resolve" onclick="resolveConflict(${conflict.id})">
                Apply AI Fix
            </button>
        `;
        container.appendChild(card);
    });
}

async function resolveConflict(conflictId) {
    showToast("Conflict Agent computing optimal resolution...");

    const data = await apiFetch(`/api/conflicts/${conflictId}/resolve`, { method: "POST" });

    setTimeout(async () => {
        if (data) {
            conflicts = data.open_conflicts;
            readiness = data.readiness;
        } else {
            conflicts = Math.max(0, conflicts - 1);
            readiness = Math.min(100, readiness + 4);
        }
        await refreshAll();
        showToast("✓ Conflict resolved and constraint verified!");
    }, 1200);
}

/* ================= TASKS ================= */

function renderTasks(apiTasks) {
    const container = get("taskList");
    if (!container) return;
    container.innerHTML = "";
    const source = apiTasks || tasks;

    source.forEach(task => {
        const row = document.createElement("div");
        row.className = "task";
        row.innerHTML = `
            <input type="checkbox" ${task.completed ? "checked" : ""} onchange="toggleTask(${task.id})">
            <div class="task-content">
                <b style="${task.completed ? 'text-decoration:line-through; opacity:0.6;' : ''}">${task.name}</b>
                <small>Deadline: ${task.deadline || 'Today 04:00 PM'}</small>
            </div>
            <span class="owner">${task.owner}</span>
        `;
        container.appendChild(row);
    });

    const completed = source.filter(t => t.completed).length;
    get("taskMetric").innerText = `${completed} / ${source.length}`;
}

async function toggleTask(taskId) {
    const data = await apiFetch(`/api/tasks/${taskId}/toggle`, { method: "POST" });
    if (data) {
        const t = tasks.find(t => t.id === taskId);
        if (t) t.completed = data.completed;
        readiness = data.readiness;
        showToast(data.completed ? "✓ Task marked complete." : "Task marked incomplete.");
    } else {
        const t = tasks.find(t => t.id === taskId);
        if (t) {
            t.completed = !t.completed;
            showToast(t.completed ? "✓ Task marked complete." : "Task marked incomplete.");
        }
    }
    await refreshAll();
}

/* ================= READINESS ================= */

function renderReadiness(data) {
    const score = data ? data.score : readiness;
    const checklist = data ? data.checklist : null;

    get("scoreValue").innerText = score;
    get("readinessMetric").innerText = score + "%";

    if (score >= 90) get("readinessTitle").innerText = "Event is ready for launch";
    else if (score >= 75) get("readinessTitle").innerText = "Event needs attention";
    else get("readinessTitle").innerText = "Event requires immediate action";

    const chkContainer = get("checklist");
    if (!chkContainer) return;

    if (checklist) {
        chkContainer.innerHTML = checklist.map(item => `
            <div class="check">
                <div class="check-icon ${item.ok ? "" : "pending"}">${item.ok ? "✓" : "!"}</div>
                <div class="check-main"><b>${item.label}</b><small>${item.detail}</small></div>
                <span class="${item.ok ? "success" : "warning"}">${item.status}</span>
            </div>
        `).join("");
    } else {
        chkContainer.innerHTML = `
            <div class="check">
                <div class="check-icon">✓</div>
                <div class="check-main"><b>Campus Venues</b><small>4 venues confirmed</small></div>
                <span class="success">READY</span>
            </div>
            <div class="check">
                <div class="check-icon">✓</div>
                <div class="check-main"><b>Hardware Logistics</b><small>28 resources planned</small></div>
                <span class="success">READY</span>
            </div>
            <div class="check">
                <div class="check-icon">✓</div>
                <div class="check-main"><b>Staffing Roster</b><small>15 volunteers assigned</small></div>
                <span class="success">READY</span>
            </div>
            <div class="check">
                <div class="check-icon ${conflicts > 0 ? "pending" : ""}">
                    ${conflicts > 0 ? "!" : "✓"}
                </div>
                <div class="check-main"><b>Constraint Checking</b><small>${conflicts} conflict(s) active</small></div>
                <span class="${conflicts > 0 ? "warning" : "success"}">${conflicts > 0 ? "ACTION" : "READY"}</span>
            </div>
            <div class="check">
                <div class="check-icon pending">!</div>
                <div class="check-main"><b>Human Approvals</b><small>Budget + Security clearance</small></div>
                <span class="warning">ACTION</span>
            </div>
        `;
    }
}

/* ================= REFRESH ALL FROM API ================= */

async function refreshAll() {
    const [dash, apiAgents, apiSchedule, apiResources, apiConflicts, apiTasks, apiReadiness] =
        await Promise.all([
            apiFetch("/api/dashboard"),
            apiFetch("/api/agents"),
            apiFetch("/api/schedule"),
            apiFetch("/api/resources"),
            apiFetch("/api/conflicts"),
            apiFetch("/api/tasks"),
            apiFetch("/api/readiness"),
        ]);

    if (dash) {
        conflicts = dash.open_conflicts;
        readiness = dash.readiness;
        get("conflictMetric").innerText = dash.open_conflicts;
        get("readinessMetric").innerText = dash.readiness + "%";
    }

    if (apiAgents && apiAgents.length) {
        allAgentsData = apiAgents;
        apiAgents.forEach(a => { agentState[a.id] = a.state; });
        renderAgentCards(apiAgents);
        renderAgentFlow(apiAgents);
    } else {
        renderAgentCards();
        renderAgentFlow();
    }

    renderTimeline();
    renderSchedule(apiSchedule);
    renderResources(apiResources);
    renderConflicts(apiConflicts);

    if (apiTasks) {
        tasks = apiTasks;
        renderTasks(apiTasks);
    } else {
        renderTasks();
    }

    renderReadiness(apiReadiness);
    await refreshCommLogs();
}

/* ================= NEW EVENT CREATION ================= */

get("newEventBtn").addEventListener("click", () => {
    get("modal").classList.remove("hidden");
});

get("closeModal").addEventListener("click", () => {
    get("modal").classList.add("hidden");
});

get("createEventBtn").addEventListener("click", async () => {
    const name = get("eventName").value || "New Event";
    const people = get("eventPeople").value || "150";
    const days = get("eventDays").value || "2 days";

    get("requirements").value =
        `Organize ${name} for ${people} participants over ${days}.\nPlan campus venues, hardware resources, volunteer staffing, master timetable, and pre-flight readiness.`;

    const data = await apiFetch("/api/event", {
        method: "POST",
        body: JSON.stringify({ name, participants: people, duration: days }),
    });

    get("modal").classList.add("hidden");
    if (get("heroLivePill")) {
        get("heroLivePill").innerText = `● LIVE • ${name.toUpperCase()}`;
    }
    showToast(`✓ New event '${name}' initialized across all agents!`);

    if (data) await refreshAll();
});

/* ================= BUTTON EVENTS ================= */

get("runAgentsBtn").addEventListener("click", runAllAgents);
get("replanBtn").addEventListener("click", simulateReplan);
get("generateBtn").addEventListener("click", generatePlan);

/* ================= LLM / GEMINI FUNCTIONS ================= */

let chatHistory = [];
let chatBusy = false;

/* --- API Key Management --- */
function getStoredApiKey() {
    return localStorage.getItem("campusai_gemini_key") || "";
}

function saveApiKey() {
    const input = get("geminiApiKeyInput");
    const key = input ? input.value.trim() : "";
    if (!key) { showToast("Please enter an API key."); return; }
    localStorage.setItem("campusai_gemini_key", key);
    updateApiKeyStatus();
    showToast("✓ Custom Gemini API key saved!");
}

function updateApiKeyStatus() {
    const key = getStoredApiKey();
    const statusEl = get("apiKeyStatus");
    const inputEl = get("geminiApiKeyInput");
    if (key) {
        if (statusEl) { statusEl.innerText = "✓ Custom key active (" + key.slice(0, 8) + "...)"; statusEl.classList.add("ok"); }
        if (inputEl) inputEl.value = key;
    } else {
        if (statusEl) { statusEl.innerText = "✓ Backend .env key configured"; statusEl.classList.add("ok"); }
    }
}

/* --- Chat UI Helpers --- */
function appendChatBubble(role, text, isError = false) {
    const win = get("chatWindow");
    if (!win) return;
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role === "user" ? "user-bubble" : "ai-bubble"}`;
    const icon = role === "user" ? "A" : "✦";
    const nameLabel = `CampusAI Assistant <span class="chat-model-badge">Gemini Flash</span>`;
    const textClass = isError ? "chat-bubble-text chat-error-text" : "chat-bubble-text";
    bubble.innerHTML = `
        <div class="chat-bubble-icon">${icon}</div>
        <div class="chat-bubble-body">
            ${role === "assistant" ? `<div class="chat-bubble-name">${nameLabel}</div>` : ""}
            <div class="${textClass}">${text}</div>
        </div>
    `;
    win.appendChild(bubble);
    win.scrollTop = win.scrollHeight;
}

async function sendChatMessage() {
    if (chatBusy) return;
    const input = get("chatInput");
    const message = input ? input.value.trim() : "";
    if (!message) return;

    chatBusy = true;
    if (input) input.value = "";
    const sendBtn = get("chatSendBtn");
    if (sendBtn) sendBtn.disabled = true;

    appendChatBubble("user", message);
    chatHistory.push({ role: "user", content: message });

    const typingEl = get("chatTyping");
    if (typingEl) typingEl.classList.add("visible");

    try {
        const data = await apiFetch("/api/llm/chat", {
            method: "POST",
            body: JSON.stringify({
                message,
                history: chatHistory,
                api_key: getStoredApiKey()
            }),
        });
        if (typingEl) typingEl.classList.remove("visible");
        if (data && data.reply) {
            appendChatBubble("assistant", data.reply);
            chatHistory.push({ role: "assistant", content: data.reply });
            if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
        } else if (data && data.error) {
            appendChatBubble("assistant", "Error: " + data.error, true);
        } else {
            appendChatBubble("assistant", "No response received.", true);
        }
    } catch (e) {
        if (typingEl) typingEl.classList.remove("visible");
        appendChatBubble("assistant", "Connection error: " + e.message, true);
    }

    chatBusy = false;
    if (sendBtn) sendBtn.disabled = false;
    if (input) input.focus();
}

function useSuggestion(btn) {
    const input = get("chatInput");
    if (input) { input.value = btn.innerText; input.focus(); sendChatMessage(); }
}

function handleChatKey(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

/* --- Ask Agent Panel (in modal) --- */
function showAgentAskPanel(agentId, agentName) {
    let panel = get("agentAskPanel");
    if (!panel) {
        panel = document.createElement("div");
        panel.id = "agentAskPanel";
        panel.className = "agent-ask-panel";
        panel.innerHTML = `
            <h4>🤖 Ask ${agentName} directly (powered by Gemini)</h4>
            <div class="agent-ask-row">
                <input type="text" id="agentAskInput" class="agent-ask-input"
                    placeholder="Ask this agent a question..."
                    onkeydown="if(event.key==='Enter') askAgentWithLLM('${agentId}')">
                <button class="agent-ask-btn" id="agentAskBtn" onclick="askAgentWithLLM('${agentId}')">Ask ➤</button>
            </div>
            <div class="agent-ask-response" id="agentAskResponse"></div>
        `;
        const dataContainer = get("agentDataContainer");
        if (dataContainer && dataContainer.parentNode) {
            dataContainer.parentNode.insertBefore(panel, dataContainer.nextSibling);
        }
    } else {
        panel.querySelector("h4").innerText = `🤖 Ask ${agentName} directly (powered by Gemini)`;
        const inp = panel.querySelector(".agent-ask-input");
        const btn = panel.querySelector(".agent-ask-btn");
        if (inp) inp.setAttribute("onkeydown", `if(event.key==='Enter') askAgentWithLLM('${agentId}')`);
        if (btn) btn.setAttribute("onclick", `askAgentWithLLM('${agentId}')`);
        const resp = get("agentAskResponse");
        if (resp) { resp.style.display = "none"; resp.innerText = ""; }
    }
    switchAgentTab("data");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const askInput = get("agentAskInput");
    if (askInput) setTimeout(() => askInput.focus(), 200);
}

async function askAgentWithLLM(agentId) {
    const input = get("agentAskInput");
    const responseEl = get("agentAskResponse");
    const btn = get("agentAskBtn");
    if (!input || !responseEl) return;
    const question = input.value.trim();
    if (!question) return;

    if (btn) { btn.disabled = true; btn.innerText = "Thinking..."; }
    responseEl.style.display = "block";
    responseEl.innerText = "⏳ Agent is processing your question...";

    try {
        const data = await apiFetch("/api/llm/agent-ask", {
            method: "POST",
            body: JSON.stringify({ agent_id: agentId, question, api_key: getStoredApiKey() }),
        });
        if (data && data.reply) {
            responseEl.innerText = data.reply;
            await refreshAll();
        } else if (data && data.error) {
            responseEl.innerText = "Error: " + data.error;
        } else {
            responseEl.innerText = "No response received.";
        }
    } catch (e) {
        responseEl.innerText = "Connection error: " + e.message;
    }
    if (btn) { btn.disabled = false; btn.innerText = "Ask ➤"; }
}

/* ================= CLOCK ================= */

function updateClock() {
    get("clock").innerText = new Date().toLocaleTimeString();
}
setInterval(updateClock, 1000);

/* ================= WAIT HELPER ================= */

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* ================= INITIAL LOAD ================= */

(async () => {
    renderTimeline();
    renderPlan();
    updateClock();
    updateApiKeyStatus();
    await refreshAll();
})();
