/* =====================================================
   CAMPUS AI
   MULTI-AGENT EVENT PLANNING SYSTEM
   Frontend — communicates with Flask backend at /api
===================================================== */

const API = "";   // same origin — Flask serves both HTML and API

/* ================= AGENTS ================= */

const agents = [
    { id: "planner",   name: "Event Planner",     icon: "✦", description: "Converts natural-language event requirements into structured objectives and constraints." },
    { id: "venue",     name: "Venue Agent",        icon: "⌂", description: "Finds suitable venues based on capacity, availability and event requirements." },
    { id: "resource",  name: "Resource Agent",     icon: "▣", description: "Allocates equipment and tracks resource availability." },
    { id: "volunteer", name: "Volunteer Agent",    icon: "♙", description: "Assigns volunteers according to skills and availability." },
    { id: "schedule",  name: "Schedule Agent",     icon: "◷", description: "Generates optimized schedules considering dependencies." },
    { id: "conflict",  name: "Conflict Detection", icon: "⚠", description: "Detects venue, resource, schedule and volunteer conflicts." },
    { id: "readiness", name: "Readiness Agent",    icon: "◉", description: "Calculates the operational readiness score of the event." },
];


/* ================= STATE (synced from backend) ================= */

let agentState  = {};
let conflicts   = 2;
let readiness   = 92;

let tasks = [
    { id: 1, name: "Confirm main auditorium booking", owner: "Venue Team",     completed: true  },
    { id: 2, name: "Reserve equipment resources",      owner: "Resource Team",  completed: true  },
    { id: 3, name: "Assign volunteers",                owner: "Volunteer Team", completed: true  },
    { id: 4, name: "Approve security plan",            owner: "Event Admin",    completed: false },
    { id: 5, name: "Resolve projector conflict",       owner: "Resource Team",  completed: false },
];

agents.forEach(a => { agentState[a.id] = "idle"; });


/* ================= DOM HELPER ================= */

function get(id) { return document.getElementById(id); }


/* ================= TOAST ================= */

function showToast(message) {
    const toast = get("toast");
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
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
        console.warn("API error:", err.message);
        return null;
    }
}


/* ================= NAVIGATION ================= */

document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", function () {
        document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
        document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
        this.classList.add("active");
        const section = get(this.dataset.section);
        section.classList.add("active");
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
});


/* ================= AGENT CARDS ================= */

function renderAgentCards(apiAgents) {
    const container = get("agentCards");
    container.innerHTML = "";
    const source = apiAgents || agents.map(a => ({ ...a, state: agentState[a.id] }));
    source.forEach(agent => {
        const card = document.createElement("div");
        card.className = "agent-card";
        const isConflict = agent.id === "conflict" && conflicts > 0;
        if (isConflict) card.classList.add("warning-card");
        let status = "● Operational";
        if (agent.state === "running")    status = "● Running...";
        if (agent.state === "completed")  status = "● Completed";
        if (isConflict)                   status = `● ${conflicts} conflicts`;
        card.innerHTML = `
            <div class="agent-icon">${agent.icon}</div>
            <h3>${agent.name}</h3>
            <p>${agent.description}</p>
            <span class="agent-status">${status}</span>
        `;
        container.appendChild(card);
    });
}


/* ================= AGENT FLOW ================= */

function renderAgentFlow(apiAgents) {
    const container = get("agentFlow");
    container.innerHTML = "";
    const source = apiAgents || agents.map(a => ({ ...a, state: agentState[a.id] }));

    source.forEach((agent, index) => {
        if (index > 0) {
            const connector = document.createElement("div");
            connector.className = "connector";
            container.appendChild(connector);
        }
        const item = document.createElement("div");
        item.className = "flow-item";
        if (agent.state === "running")   item.classList.add("running");
        if (agent.state === "completed") item.classList.add("done");
        const isConflict = agent.id === "conflict" && conflicts > 0;
        if (isConflict) item.classList.add("warning");
        let message = "Waiting";
        if (agent.state === "running")   message = "Agent working...";
        if (agent.state === "completed") message = "Completed";
        if (isConflict)                  message = `${conflicts} conflicts detected`;
        item.innerHTML = `
            <span class="flow-number">0${index + 1}</span>
            <div>
                <b>${agent.name}</b>
                <small>${message}</small>
            </div>
        `;
        container.appendChild(item);
    });

    const completed = source.filter(a => a.state === "completed").length;
    get("activeMetric").innerText = `${completed} / 7`;
}


/* ================= TIMELINE ================= */

const scheduleData = [
    ["08:30", "Registration",    "Main Auditorium", "Volunteer Agent"],
    ["09:00", "Opening Ceremony","Main Auditorium", "Event Planner"],
    ["10:00", "Hackathon Begins","Innovation Lab",  "Schedule Agent"],
    ["13:00", "Lunch",           "Food Court",      "Support Team"],
    ["14:00", "AI Workshop",     "Seminar Hall",    "Event Planner"],
    ["18:00", "Judging",         "Innovation Lab",  "Volunteer Agent"],
];

function renderTimeline() {
    const container = get("timeline");
    container.innerHTML = "";
    scheduleData.slice(0, 5).forEach(item => {
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


/* ================= PLAN ================= */

function renderPlan(plan) {
    const p = plan || {
        event_type: "AI Hackathon", participants: 150, duration: "2 Days",
        venues_recommended: 3, resources_required: 28, volunteers_required: 15, approvals_required: 2,
    };
    get("planOutput").innerHTML = `
        <div class="plan-row"><span>Event Type</span><b>${p.event_type}</b></div>
        <div class="plan-row"><span>Participants</span><b>${p.participants}</b></div>
        <div class="plan-row"><span>Duration</span><b>${p.duration}</b></div>
        <div class="plan-row"><span>Venues</span><b>${p.venues_recommended} Recommended</b></div>
        <div class="plan-row"><span>Resources</span><b>${p.resources_required} Required</b></div>
        <div class="plan-row"><span>Volunteers</span><b>${p.volunteers_required} Required</b></div>
        <div class="plan-row"><span>Approvals</span><b>${p.approvals_required} Required</b></div>
    `;
}


/* ================= SCHEDULE TABLE ================= */

function renderSchedule(apiSchedule) {
    const table = get("scheduleTable");
    table.innerHTML = "";
    const source = apiSchedule || scheduleData.map(i => ({ time: i[0], activity: i[1], venue: i[2], owner: i[3], status: "READY" }));
    source.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${item.time}</td>
            <td><b>${item.activity}</b></td>
            <td>${item.venue}</td>
            <td>${item.owner}</td>
            <td><span class="badge">${item.status || "READY"}</span></td>
        `;
        table.appendChild(row);
    });
}


/* ================= RESOURCES ================= */

function renderResources(apiResources) {
    const container = get("resourceGrid");
    container.innerHTML = "";
    const source = apiResources || [
        { name: "Projectors",       allocated: 8,   available: 10,  utilization: 80  },
        { name: "Laptops",          allocated: 120,  available: 120, utilization: 100 },
        { name: "Microphones",      allocated: 12,   available: 15,  utilization: 80  },
        { name: "Networking Kits",  allocated: 30,   available: 35,  utilization: 86  },
        { name: "Extension Boards", allocated: 45,   available: 50,  utilization: 90  },
        { name: "First-Aid Kits",   allocated: 4,    available: 5,   utilization: 80  },
    ];
    source.forEach(resource => {
        const pct = resource.utilization ?? Math.round(resource.allocated / resource.available * 100);
        const card = document.createElement("div");
        card.className = "resource";
        card.innerHTML = `
            <b>${resource.name}</b>
            <p>${resource.allocated} allocated / ${resource.available} available</p>
            <div class="bar"><span style="width:${pct}%"></span></div>
            <small>${pct}% utilization</small>
        `;
        container.appendChild(card);
    });
}


/* ================= CONFLICTS ================= */

function renderConflicts(apiConflicts) {
    const container = get("conflictList");
    container.innerHTML = "";
    const source = apiConflicts !== undefined ? apiConflicts : null;
    const count  = source ? source.length : conflicts;

    if (count === 0) {
        container.innerHTML = `
            <div class="card">
                <h3>✓ No conflicts detected</h3>
                <p>All current venue, resource and schedule constraints are clear.</p>
            </div>
        `;
        return;
    }

    const fallback = [
        { id: 1, title: "Projector double booking",
          description: "Projector P-07 is requested in Seminar Hall and Innovation Lab at 14:00.", priority: "HIGH" },
        { id: 2, title: "Volunteer overlap",
          description: "Two volunteers are assigned to registration and workshop support at the same time.", priority: "MEDIUM" },
    ];

    (source || fallback.slice(0, count)).forEach(conflict => {
        const card = document.createElement("div");
        card.className = "conflict";
        if (conflict.priority === "HIGH") card.classList.add("high");
        card.innerHTML = `
            <div>
                <b>${conflict.title}</b>
                <p>${conflict.description}</p>
            </div>
            <button class="resolve" onclick="resolveConflict(${conflict.id})">
                AI Suggest Fix
            </button>
        `;
        container.appendChild(card);
    });
}


/* ================= RESOLVE CONFLICT ================= */

async function resolveConflict(conflictId) {
    showToast("AI analyzing possible conflict resolution...");

    // Try backend first
    const data = await apiFetch(`/api/conflicts/${conflictId}/resolve`, { method: "POST" });

    setTimeout(async () => {
        if (data) {
            conflicts = data.open_conflicts;
            readiness = data.readiness;
        } else {
            conflicts = Math.max(0, conflicts - 1);
            readiness = Math.min(100, readiness + 3);
        }
        await refreshAll();
        showToast("✓ Conflict resolution applied.");
    }, 1500);
}


/* ================= TASKS ================= */

function renderTasks(apiTasks) {
    const container = get("taskList");
    container.innerHTML = "";
    const source = apiTasks || tasks;

    source.forEach(task => {
        const row = document.createElement("div");
        row.className = "task";
        row.innerHTML = `
            <input type="checkbox" ${task.completed ? "checked" : ""}
                   onchange="toggleTask(${task.id})">
            <div>
                <b>${task.name}</b>
                <small>Deadline: Today</small>
            </div>
            <span class="owner">${task.owner}</span>
        `;
        container.appendChild(row);
    });

    updateTaskMetric(source);
}


/* ================= TOGGLE TASK ================= */

async function toggleTask(taskId) {
    const data = await apiFetch(`/api/tasks/${taskId}/toggle`, { method: "POST" });

    if (data) {
        // update local cache
        const t = tasks.find(t => t.id === taskId);
        if (t) t.completed = data.completed;
        readiness = data.readiness;
        showToast(data.completed ? "✓ Task completed." : "Task marked incomplete.");
    } else {
        const t = tasks.find(t => t.id === taskId);
        if (t) {
            t.completed = !t.completed;
            showToast(t.completed ? "✓ Task completed." : "Task marked incomplete.");
        }
    }

    await refreshAll();
}


/* ================= TASK METRIC ================= */

function updateTaskMetric(source) {
    const src       = source || tasks;
    const completed = src.filter(t => t.completed).length;
    get("taskMetric").innerText = `${completed} / ${src.length}`;
}


/* ================= READINESS ================= */

function renderReadiness(data) {
    const score     = data ? data.score     : readiness;
    const checklist = data ? data.checklist : null;

    get("scoreValue").innerText = score;
    get("readinessMetric").innerText = score + "%";

    if      (score >= 90) get("readinessTitle").innerText = "Event is nearly ready";
    else if (score >= 75) get("readinessTitle").innerText = "Event needs attention";
    else                  get("readinessTitle").innerText = "Event requires action";

    if (checklist) {
        get("checklist").innerHTML = checklist.map(item => `
            <div class="check">
                <div class="check-icon ${item.ok ? "" : "pending"}">${item.ok ? "✓" : "!"}</div>
                <div class="check-main"><b>${item.label}</b><small>${item.detail}</small></div>
                <span class="${item.ok ? "success" : "warning"}">${item.status}</span>
            </div>
        `).join("");
    } else {
        get("checklist").innerHTML = `
            <div class="check">
                <div class="check-icon">✓</div>
                <div class="check-main"><b>Venue Plan</b><small>3 venues assigned</small></div>
                <span class="success">READY</span>
            </div>
            <div class="check">
                <div class="check-icon">✓</div>
                <div class="check-main"><b>Resource Allocation</b><small>28 resources planned</small></div>
                <span class="success">READY</span>
            </div>
            <div class="check">
                <div class="check-icon">✓</div>
                <div class="check-main"><b>Volunteer Coverage</b><small>15 volunteers assigned</small></div>
                <span class="success">READY</span>
            </div>
            <div class="check">
                <div class="check-icon ${conflicts > 0 ? "pending" : ""}">
                    ${conflicts > 0 ? "!" : "✓"}
                </div>
                <div class="check-main"><b>Conflict Resolution</b><small>${conflicts} conflict(s) remaining</small></div>
                <span class="${conflicts > 0 ? "warning" : "success"}">${conflicts > 0 ? "ACTION" : "READY"}</span>
            </div>
            <div class="check">
                <div class="check-icon pending">!</div>
                <div class="check-main"><b>Human Approvals</b><small>Budget + Security approval</small></div>
                <span class="warning">ACTION</span>
            </div>
        `;
    }
}


/* ================= RUN ALL AGENTS ================= */

async function runAllAgents() {
    showToast("✦ Multi-agent planning started...");

    // Animate locally first
    for (const agent of agents) {
        agentState[agent.id] = "running";
        renderAgentCards();
        renderAgentFlow();
        await wait(800);
        agentState[agent.id] = "completed";
        renderAgentCards();
        renderAgentFlow();
    }

    // Sync with backend
    const data = await apiFetch("/api/agents/run-all", { method: "POST" });
    if (data) readiness = data.readiness;

    await refreshAll();
    showToast("✓ All agents completed successfully!");
}


/* ================= SIMULATE REPLAN ================= */

async function simulateReplan() {
    showToast("↻ Campus condition changed. AI replanning...");
    setTimeout(() => showToast("Venue Agent searching alternative venues..."), 1000);
    setTimeout(() => showToast("Schedule Agent rebuilding timetable..."), 2000);

    setTimeout(async () => {
        const data = await apiFetch("/api/replan", { method: "POST" });
        if (data) {
            conflicts = data.open_conflicts;
            readiness = data.readiness;
            // sync agent state
            if (data.agent_states) {
                Object.assign(agentState, data.agent_states);
            }
        } else {
            conflicts = 0;
            readiness = 98;
        }
        await refreshAll();
        showToast("✓ Replan completed. Conflicts resolved.");
    }, 3500);
}


/* ================= GENERATE PLAN ================= */

async function generatePlan() {
    const text = get("requirements").value.trim();
    if (!text) { showToast("Please enter event requirements."); return; }

    showToast("✦ Event Planner analyzing requirements...");

    const data = await apiFetch("/api/plan/generate", {
        method: "POST",
        body: JSON.stringify({ requirements: text }),
    });

    setTimeout(() => {
        renderPlan(data);
        showToast("✓ Operational plan generated!");
        document.querySelector('[data-section="agents"]').click();
    }, 2000);
}


/* ================= UPDATE DASHBOARD ================= */

async function updateDashboard(dashData) {
    if (dashData) {
        get("conflictMetric").innerText = dashData.open_conflicts;
        get("readinessMetric").innerText = dashData.readiness + "%";
        get("activeMetric").innerText = dashData.active_agents;
        get("taskMetric").innerText = dashData.tasks;
        conflicts = dashData.open_conflicts;
        readiness = dashData.readiness;
    } else {
        get("conflictMetric").innerText = conflicts;
    }
    renderAgentCards();
    renderAgentFlow();
    renderConflicts();
    renderReadiness();
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

    if (apiAgents) {
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
}


/* ================= NEW EVENT ================= */

get("newEventBtn").addEventListener("click", () => {
    get("modal").classList.remove("hidden");
});

get("closeModal").addEventListener("click", () => {
    get("modal").classList.add("hidden");
});

get("createEventBtn").addEventListener("click", async () => {
    const name    = get("eventName").value;
    const people  = get("eventPeople").value;
    const days    = get("eventDays").value;

    get("requirements").value =
        `Organize ${name} for ${people} participants over ${days}.\nPlan venues, resources, volunteers, schedule, conflict detection, security and approvals.`;

    // Create event via API
    const data = await apiFetch("/api/event", {
        method: "POST",
        body: JSON.stringify({ name, participants: people, duration: days }),
    });

    get("modal").classList.add("hidden");
    showToast("✓ New event created!");

    if (data) await refreshAll();
});


/* ================= BUTTONS ================= */

get("runAgentsBtn").addEventListener("click",  runAllAgents);
get("replanBtn").addEventListener("click",     simulateReplan);
get("generateBtn").addEventListener("click",   generatePlan);


/* ================= CLOCK ================= */

function updateClock() {
    get("clock").innerText = new Date().toLocaleString();
}
setInterval(updateClock, 1000);


/* ================= WAIT ================= */

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/* ================= INITIAL LOAD ================= */

(async () => {
    renderTimeline();
    renderPlan();
    updateClock();
    await refreshAll();
})();
