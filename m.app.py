"""
CampusAI - Multi-Agent Event Planning System
Python Flask Backend with Deep Agent-Data Connections
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import copy, os, datetime

# Load environment variables from .env file
load_dotenv()

try:
    from google import genai as google_genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

app = Flask(__name__, static_folder=None)
CORS(app)

# ─────────────────────────────────────────────
#  DOMAIN DATA STORES (Governed by Agents)
# ─────────────────────────────────────────────

VENUES = [
    {
        "id": "v-1",
        "name": "Main Auditorium",
        "capacity": 350,
        "status": "Confirmed",
        "assigned_to": "Opening Ceremony & Keynotes",
        "equipment": ["Dual Laser Projector", "Wireless Mic System", "Stage Lighting", "Live Stream Hub"],
        "coordinator": "Dr. Miller (AV Dept)",
        "occupancy_rate": 85
    },
    {
        "id": "v-2",
        "name": "Innovation Lab",
        "capacity": 90,
        "status": "Confirmed",
        "assigned_to": "Hackathon Coding & Mentorship",
        "equipment": ["45 Dev Workstations", "Gigabit Ethernet", "Smart Presentation Board"],
        "coordinator": "Prof. Vance (CS Dept)",
        "occupancy_rate": 100
    },
    {
        "id": "v-3",
        "name": "Seminar Hall A",
        "capacity": 140,
        "status": "Confirmed",
        "assigned_to": "AI Workshops & Breakout Sessions",
        "equipment": ["Projector P-07", "Podium Mic", "Tiered Audio"],
        "coordinator": "Sarah Jenkins (Events Office)",
        "occupancy_rate": 72
    },
    {
        "id": "v-4",
        "name": "Food Court Zone B",
        "capacity": 250,
        "status": "Reserved",
        "assigned_to": "Networking Lunch & Refreshments",
        "equipment": ["Buffet Lines", "Waste Stations", "Hydration Kiosks"],
        "coordinator": "Campus Catering Services",
        "occupancy_rate": 60
    }
]

VOLUNTEERS = [
    {"id": "vol-1", "name": "Aarav Sharma", "role": "Lead Coordinator", "team": "Management", "shift": "08:00 - 19:00", "assigned": "Command Center", "skills": "Leadership, Crisis Handling", "status": "Checked In"},
    {"id": "vol-2", "name": "Priya Nair", "role": "Registration Lead", "team": "Desk Operations", "shift": "08:00 - 12:00", "assigned": "Main Auditorium Foyer", "skills": "QR Scanner, Badge Printing", "status": "Active"},
    {"id": "vol-3", "name": "Rohan Mehta", "role": "Tech Mentor", "team": "Tech Support", "shift": "09:30 - 18:30", "assigned": "Innovation Lab", "skills": "Python, PyTorch, Cloud APIs", "status": "Active"},
    {"id": "vol-4", "name": "Ananya Roy", "role": "Workshop Usher", "team": "Venue Support", "shift": "13:00 - 17:00", "assigned": "Seminar Hall A", "skills": "Crowd Control, AV Assist", "status": "Scheduled"},
    {"id": "vol-5", "name": "Karthik Verma", "role": "AV Technician", "team": "Tech Support", "shift": "08:00 - 18:00", "assigned": "Main Auditorium", "skills": "Audio Mixing, OBS Streaming", "status": "Active"},
    {"id": "vol-6", "name": "Neha Gupta", "role": "Hospitality & Catering", "team": "Logistics", "shift": "12:00 - 15:00", "assigned": "Food Court Zone B", "skills": "Food Safety, Vendor Liaison", "status": "Scheduled"},
    {"id": "vol-7", "name": "Siddharth Rao", "role": "Judge Liaison", "team": "Management", "shift": "16:00 - 19:30", "assigned": "Innovation Lab & Lounge", "skills": "Evaluation Rubrics, Timekeeping", "status": "Scheduled"},
    {"id": "vol-8", "name": "Meera Iyer", "role": "Registration Support", "team": "Desk Operations", "shift": "08:00 - 11:30", "assigned": "Main Auditorium Foyer", "skills": "Welcome Kits, ID Verification", "status": "Active"}
]

SCHEDULE = [
    {"id": 1, "time": "08:30", "activity": "Registration & Welcome Kits", "venue": "Main Auditorium Foyer", "owner": "Volunteer Agent", "status": "READY", "duration": "30m"},
    {"id": 2, "time": "09:00", "activity": "Opening Ceremony & Keynote", "venue": "Main Auditorium", "owner": "Event Planner Agent", "status": "READY", "duration": "60m"},
    {"id": 3, "time": "10:00", "activity": "Hackathon Begins & Team Sprint", "venue": "Innovation Lab", "owner": "Schedule Agent", "status": "READY", "duration": "180m"},
    {"id": 4, "time": "13:00", "activity": "Networking Lunch & Refreshments", "venue": "Food Court Zone B", "owner": "Resource Agent", "status": "READY", "duration": "60m"},
    {"id": 5, "time": "14:00", "activity": "AI Agent & LLM Workshop", "venue": "Seminar Hall A", "owner": "Event Planner Agent", "status": "READY", "duration": "120m"},
    {"id": 6, "time": "18:00", "activity": "Project Demos & Final Judging", "venue": "Innovation Lab", "owner": "Volunteer Agent", "status": "READY", "duration": "90m"},
]

RESOURCES = [
    {"id": "r-1", "name": "High-Lumen Projectors", "allocated": 8, "available": 10, "unit": "units", "location": "Central AV Vault", "category": "Audio/Visual"},
    {"id": "r-2", "name": "Developer Laptops", "allocated": 120, "available": 120, "unit": "units", "location": "CS Tech Reserve", "category": "Computing"},
    {"id": "r-3", "name": "Wireless Microphones", "allocated": 12, "available": 15, "unit": "units", "location": "Auditorium Control Booth", "category": "Audio/Visual"},
    {"id": "r-4", "name": "High-Speed Mesh Kits", "allocated": 30, "available": 35, "unit": "nodes", "location": "IT Infrastructure Locker", "category": "Networking"},
    {"id": "r-5", "name": "Heavy-Duty Power Strips", "allocated": 45, "available": 50, "unit": "units", "location": "Campus Facilities Depot", "category": "Power"},
    {"id": "r-6", "name": "Emergency Medical Kits", "allocated": 4, "available": 5, "unit": "kits", "location": "Campus Health Center", "category": "Safety"},
]

CONFLICT_TEMPLATES = [
    {
        "id": 1,
        "title": "Projector P-07 double booking",
        "description": "Projector P-07 is requested simultaneously in Seminar Hall A and Innovation Lab at 14:00.",
        "priority": "HIGH",
        "agent": "Conflict Detection",
        "affected_resources": ["Projector P-07"],
        "recommended_fix": "Dispatch spare backup Projector P-11 from Central AV Vault to Innovation Lab.",
        "resolved": False
    },
    {
        "id": 2,
        "title": "Volunteer overlap in Registration vs Workshop",
        "description": "Two volunteers are assigned to registration desk and workshop setup at the exact same shift window.",
        "priority": "MEDIUM",
        "agent": "Conflict Detection",
        "affected_resources": ["Volunteers: Priya Nair, Neha Gupta"],
        "recommended_fix": "Stagger registration closing to 11:30 and auto-reassign Neha Gupta to Seminar Hall at 13:00.",
        "resolved": False
    }
]

conflicts = copy.deepcopy(CONFLICT_TEMPLATES)
readiness = 92

TASKS = [
    {"id": 1, "name": "Confirm Main Auditorium & Seminar Hall booking", "owner": "Venue Agent", "agent_id": "venue", "completed": True, "deadline": "Today 10:00 AM"},
    {"id": 2, "name": "Reserve 120 laptops & 30 mesh networking kits", "owner": "Resource Agent", "agent_id": "resource", "completed": True, "deadline": "Today 11:30 AM"},
    {"id": 3, "name": "Assign 15 volunteers across 4 campus zones", "owner": "Volunteer Agent", "agent_id": "volunteer", "completed": True, "deadline": "Today 12:00 PM"},
    {"id": 4, "name": "Approve event security & safety compliance plan", "owner": "Event Admin", "agent_id": "readiness", "completed": False, "deadline": "Today 03:00 PM"},
    {"id": 5, "name": "Resolve Projector P-07 allocation conflict", "owner": "Conflict Detection", "agent_id": "conflict", "completed": False, "deadline": "Today 04:00 PM"},
]

current_event = {
    "id": 1,
    "name": "AI Hackathon 2026",
    "participants": 150,
    "duration": "2 days",
    "type": "AI Hackathon & Build Sprint",
    "venues": 4,
    "resources": 28,
    "volunteers": 15,
    "approvals": 2,
}

# ─────────────────────────────────────────────
#  RICH AGENT REGISTRY & INTELLIGENCE SPECS
# ─────────────────────────────────────────────

AGENT_PROFILES = [
    {
        "id": "planner",
        "name": "Event Planner Agent",
        "icon": "✦",
        "tagline": "Strategic Objective Decomposition",
        "role": "Master Orchestrator",
        "description": "Converts natural-language event requirements into structured objectives, budget estimates, and sub-agent operational directives.",
        "model": "Gemini 2.5 Pro (Neural Core)",
        "target_section": "planner",
        "latency_ms": 180,
        "confidence": "98.4%",
        "managed_domain": "Event Blueprint & Requirements Intake",
        "system_prompt": "You are the Master Campus Event Planner. Ingest free-form user event prompts, parse attendee capacity, duration, objectives, and delegate work breakdown structures to specialized agents.",
        "inputs": ["Natural Language Prompt", "Participant Headcount", "Duration Constraints"],
        "outputs": ["Event Strategy Matrix", "Capacity Requirements", "Downstream Work Orders"],
        "activity_logs": [
            {"time": "11:00:12", "level": "INFO", "text": "Ingested event intake prompt: 'Organize a 2-day AI hackathon for 150 students...'"},
            {"time": "11:00:14", "level": "REASONING", "text": "Derived participant requirement: 150 students -> 3-4 parallel venues needed."},
            {"time": "11:00:15", "level": "DECISION", "text": "Generated 7-point operational roadmap. Dispatched execution directives to Venue and Resource Agents."},
            {"time": "11:00:16", "level": "SYNC", "text": "Plan status synchronized with central command state."}
        ]
    },
    {
        "id": "venue",
        "name": "Venue Agent",
        "icon": "⌂",
        "tagline": "Campus Space & Facility Optimization",
        "role": "Spatial Allocation Engine",
        "description": "Evaluates campus spatial models, checks real-time hall bookings, verifies seating capacity against attendee surges, and coordinates facility readiness.",
        "model": "Gemini 2.0 Flash (Spatial Engine)",
        "target_section": "schedule",
        "latency_ms": 115,
        "confidence": "99.1%",
        "managed_domain": "Campus Venues & Spatial Bookings (4 Active Halls)",
        "system_prompt": "Monitor all campus spaces, auditorium zones, and labs. Enforce fire code limits, AV readiness, and ensure zero double-booking on physical spaces.",
        "inputs": ["Target Audience: 150", "Session Formats (Keynote, Workshop, Hack Space)"],
        "outputs": ["4 Confirmed Venues (830 total seat capacity)", "Venue Layout Maps", "Coordinator Contact List"],
        "activity_logs": [
            {"time": "11:01:05", "level": "INFO", "text": "Scanning campus calendar for 2-day Hackathon slot..."},
            {"time": "11:01:07", "level": "REASONING", "text": "Main Auditorium (cap: 350) allocated for Keynote. Innovation Lab (cap: 90) reserved for Hacking."},
            {"time": "11:01:08", "level": "DECISION", "text": "Secured Seminar Hall A for breakout sessions and Food Court Zone B for catering."},
            {"time": "11:01:09", "level": "SYNC", "text": "Spatial reservation confirmations dispatched to Facilities Bureau."}
        ]
    },
    {
        "id": "resource",
        "name": "Resource Agent",
        "icon": "▣",
        "tagline": "Inventory & Hardware Fleet Allocation",
        "role": "Logistics & Fleet Controller",
        "description": "Allocates equipment, laptops, projectors, power grids, network mesh points, and tracks real-time inventory utilization thresholds.",
        "model": "Antigravity Resource Optimizer 2.0",
        "target_section": "resources",
        "latency_ms": 140,
        "confidence": "96.7%",
        "managed_domain": "Hardware & Facilities Inventory (6 Asset Classes)",
        "system_prompt": "Balance hardware allocation, compute dev laptops, network switches, and AV rigs. Warn when resource utilization exceeds 85%.",
        "inputs": ["150 Participants", "Workshop Technical Requirements", "AV Needs"],
        "outputs": ["120 Dev Laptops Allocated", "8 Projectors Assigned", "30 Mesh Wi-Fi Nodes Deployed"],
        "activity_logs": [
            {"time": "11:02:10", "level": "INFO", "text": "Evaluating hardware inventory against 150 participant needs."},
            {"time": "11:02:12", "level": "WARNING", "text": "Laptops at 100% utilization (120/120 allocated). Triggering reserve hold."},
            {"time": "11:02:14", "level": "DECISION", "text": "Assigned 8 projectors, 12 wireless mics, 45 power boards, and 4 medical kits."},
            {"time": "11:02:15", "level": "SYNC", "text": "Inventory checkout orders transmitted to Central Depot."}
        ]
    },
    {
        "id": "volunteer",
        "name": "Volunteer Agent",
        "icon": "♙",
        "tagline": "Student Staffing & Shift Orchestration",
        "role": "Staffing & Roster Coordinator",
        "description": "Matches student volunteers to critical roles based on verified technical skills, certifications, availability hours, and campus sector coverage.",
        "model": "Gemini 2.0 Flash (Staffing Node)",
        "target_section": "tasks",
        "latency_ms": 130,
        "confidence": "97.5%",
        "managed_domain": "Staffing Matrix & Shifts (15 Volunteers Active)",
        "system_prompt": "Analyze volunteer capabilities, create balanced coverage rosters, prevent fatigue/burnout, and provide instant emergency replacements.",
        "inputs": ["Event Hours: 08:30 - 19:30", "Zone Requirements (Registration, Lab, Stage, Food)"],
        "outputs": ["15 Assigned Volunteers", "4 Specialized Shift Teams", "100% Zone Coverage"],
        "activity_logs": [
            {"time": "11:03:00", "level": "INFO", "text": "Querying volunteer registry for verified technical and operations staff."},
            {"time": "11:03:02", "level": "REASONING", "text": "Assigned Aarav Sharma as Lead Coordinator and Priya Nair to Registration Desk."},
            {"time": "11:03:04", "level": "DECISION", "text": "Allocated 8 active shifts across Management, Tech Support, and Logistics."},
            {"time": "11:03:05", "level": "SYNC", "text": "Personalized digital schedules sent to volunteer mobile apps."}
        ]
    },
    {
        "id": "schedule",
        "name": "Schedule Agent",
        "icon": "◷",
        "tagline": "Timetable & Critical-Path Optimization",
        "role": "Temporal Sequence Optimizer",
        "description": "Builds time-slot matrices, resolves chronological dependencies between keynotes, hacking sprints, workshops, and judging sessions.",
        "model": "Chronos Temporal Engine v3",
        "target_section": "schedule",
        "latency_ms": 160,
        "confidence": "99.0%",
        "managed_domain": "Master Event Timetable (6 Chronological Milestones)",
        "system_prompt": "Synthesize timeline from 08:30 to 19:30. Enforce buffer times between speaker switchovers and avoid venue conflict overlaps.",
        "inputs": ["6 Planned Activities", "Speaker Durations", "Venue Availability Slots"],
        "outputs": ["Optimized Master Timetable", "Dependency Graph", "Real-Time Schedule Feed"],
        "activity_logs": [
            {"time": "11:04:00", "level": "INFO", "text": "Building multi-track schedule timetable across 4 campus venues."},
            {"time": "11:04:02", "level": "REASONING", "text": "Inserted 30m buffer between Opening Ceremony and Hackathon Sprint Start."},
            {"time": "11:04:03", "level": "DECISION", "text": "Aligned AI Workshop (14:00) with Lunch conclusion to maximize attendance."},
            {"time": "11:04:04", "level": "SYNC", "text": "Schedule published to attendee mobile portals and digital signage."}
        ]
    },
    {
        "id": "conflict",
        "name": "Conflict Detection",
        "icon": "⚠",
        "tagline": "Constraint Validation & Automated Resolution",
        "role": "Autonomous Anomaly Resolver",
        "description": "Continuously scans for double-bookings, equipment shortfalls, schedule overlaps, and volunteer collisions with self-healing recommendations.",
        "model": "Gemini 2.5 Pro (Constraint Solver)",
        "target_section": "conflicts",
        "latency_ms": 95,
        "confidence": "99.8%",
        "managed_domain": "Real-Time Constraint Guard (2 Active Alerts)",
        "system_prompt": "Perform continuous constraint satisfaction checks. Flag critical path bottlenecks, double-booked equipment, and generate 1-click self-healing fixes.",
        "inputs": ["Live Venue Bookings", "Equipment Fleet Matrix", "Volunteer Shift Schedules"],
        "outputs": ["Active Conflict Audit", "Severity Classifications", "One-Click Automated Fixes"],
        "activity_logs": [
            {"time": "11:05:10", "level": "INFO", "text": "Running continuous heuristic scan across all operational streams."},
            {"time": "11:05:12", "level": "WARNING", "text": "Detected HIGH priority collision: Projector P-07 requested in 2 halls at 14:00."},
            {"time": "11:05:13", "level": "WARNING", "text": "Detected MEDIUM priority overlap: Volunteer shift collision in Registration Desk."},
            {"time": "11:05:14", "level": "DECISION", "text": "Computed resolution strategies with 98% operational feasibility."}
        ]
    },
    {
        "id": "readiness",
        "name": "Readiness Agent",
        "icon": "◉",
        "tagline": "Operational Scoring & Pre-Flight Audit",
        "role": "Governance & Quality Assurer",
        "description": "Aggregates signals from all agents, calculates dynamic readiness score (0-100%), performs pre-flight safety audits, and tracks executive approvals.",
        "model": "AuditGuard Governance Matrix",
        "target_section": "readiness",
        "latency_ms": 110,
        "confidence": "98.9%",
        "managed_domain": "Pre-Flight Health & Executive Approvals (Score: 92/100)",
        "system_prompt": "Audit all event subsystems. Compute weighted readiness index based on venue security, resource sufficiency, volunteer coverage, and conflict counts.",
        "inputs": ["4 Sub-Agent Status Feeds", "Resolved Conflict Ratio", "Executive Sign-Off State"],
        "outputs": ["Readiness Score (92%)", "Pre-Flight Checklist Status", "Go / No-Go Decision Vector"],
        "activity_logs": [
            {"time": "11:06:01", "level": "INFO", "text": "Aggregating telemetry from all 6 active operational agents."},
            {"time": "11:06:03", "level": "REASONING", "text": "Venue: 100% | Resources: 95% | Volunteers: 100% | Open Conflicts: -8% | Approvals: Pending."},
            {"time": "11:06:04", "level": "DECISION", "text": "Assigned Composite Event Readiness Index: 92/100 (Operational - Approaching Go Status)."},
            {"time": "11:06:05", "level": "SYNC", "text": "Readiness dashboard broadcasted to Event Admin executive console."}
        ]
    }
]

agent_state = {a["id"]: "idle" for a in AGENT_PROFILES}

# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────

def active_conflicts():
    return [c for c in conflicts if not c["resolved"]]

def recalc_readiness():
    global readiness
    open_c = len(active_conflicts())
    done_t = sum(1 for t in TASKS if t["completed"])
    base = 65 + done_t * 6 - open_c * 5
    readiness = max(0, min(100, base))

def get_now_time():
    return datetime.datetime.now().strftime("%H:%M:%S")

def add_agent_log(agent_id, level, text):
    for a in AGENT_PROFILES:
        if a["id"] == agent_id:
            a["activity_logs"].append({
                "time": get_now_time(),
                "level": level,
                "text": text
            })
            if len(a["activity_logs"]) > 15:
                a["activity_logs"] = a["activity_logs"][-15:]

# ─────────────────────────────────────────────
#  INTER-AGENT COMMUNICATION BUS & MESSAGE STORE
# ─────────────────────────────────────────────

INTER_AGENT_MESSAGES = [
    {
        "id": "msg-001",
        "timestamp": "11:00:15",
        "from_agent": "planner",
        "from_name": "Event Planner Agent",
        "to_agent": "venue",
        "to_name": "Venue Agent",
        "channel": "SPACE_REQUIREMENT_ORDER",
        "topic": "Campus Hall Reservation Directives",
        "payload": {
            "attendees": 150,
            "duration": "2 Days",
            "tracks": ["Keynote Auditorium", "Coding Lab", "AI Workshop Hall", "Catering Space"]
        },
        "summary": "Transmitted spatial capacity order for 150 participants across 4 activity tracks.",
        "status": "DELIVERED & ACKNOWLEDGED",
        "latency": "14ms"
    },
    {
        "id": "msg-002",
        "timestamp": "11:00:16",
        "from_agent": "planner",
        "from_name": "Event Planner Agent",
        "to_agent": "resource",
        "to_name": "Resource Agent",
        "channel": "HARDWARE_FLEET_ORDER",
        "topic": "Equipment Allocation Request",
        "payload": {
            "requested": ["120 Laptops", "8 Laser Projectors", "30 Mesh Wi-Fi Nodes", "45 Power Strips", "4 Medical Kits"]
        },
        "summary": "Dispatched hardware asset requisition order for 120 dev workstations and AV equipment.",
        "status": "DELIVERED & ACKNOWLEDGED",
        "latency": "18ms"
    },
    {
        "id": "msg-003",
        "timestamp": "11:00:17",
        "from_agent": "planner",
        "from_name": "Event Planner Agent",
        "to_agent": "volunteer",
        "to_name": "Volunteer Agent",
        "channel": "STAFFING_ROSTER_ORDER",
        "topic": "Student Volunteer Deployment",
        "payload": {
            "headcount_required": 15,
            "teams": ["Management", "Tech Mentors", "Registration", "Venue Logistics"]
        },
        "summary": "Dispatched staff deployment work order for 15 student volunteer coordinators.",
        "status": "DELIVERED & ACKNOWLEDGED",
        "latency": "12ms"
    },
    {
        "id": "msg-004",
        "timestamp": "11:01:08",
        "from_agent": "venue",
        "from_name": "Venue Agent",
        "to_agent": "schedule",
        "to_name": "Schedule Agent",
        "channel": "SPATIAL_AVAILABILITY_MATRIX",
        "topic": "Verified Campus Venue Slot Feed",
        "payload": {
            "venues_locked": [
                {"name": "Main Auditorium", "cap": 350, "slot": "08:30 - 11:00"},
                {"name": "Innovation Lab", "cap": 90, "slot": "10:00 - 19:30"},
                {"name": "Seminar Hall A", "cap": 140, "slot": "14:00 - 16:00"},
                {"name": "Food Court Zone B", "cap": 250, "slot": "13:00 - 14:00"}
            ]
        },
        "summary": "Transmitted locked venue timeframes (830 total seat capacity) to timetable synthesis engine.",
        "status": "DELIVERED & PROCESSED",
        "latency": "22ms"
    },
    {
        "id": "msg-005",
        "timestamp": "11:02:14",
        "from_agent": "resource",
        "from_name": "Resource Agent",
        "to_agent": "conflict",
        "to_name": "Conflict Detection",
        "channel": "INVENTORY_ALLOCATION_FEED",
        "topic": "Asset Telemetry & Utilization Broadcast",
        "payload": {
            "allocated_items": 219,
            "utilization": "88%",
            "flags": ["Projector P-07 requested in Seminar Hall A and Innovation Lab simultaneously"]
        },
        "summary": "Shared inventory allocation matrix and flagged Projector P-07 dual-hall assignment.",
        "status": "DELIVERED & EVALUATED",
        "latency": "16ms"
    },
    {
        "id": "msg-006",
        "timestamp": "11:03:04",
        "from_agent": "volunteer",
        "from_name": "Volunteer Agent",
        "to_agent": "conflict",
        "to_name": "Conflict Detection",
        "channel": "STAFF_ROSTER_TELEMETRY",
        "topic": "Volunteer Shift Validation",
        "payload": {
            "staff_count": 15,
            "shifts_assigned": 8,
            "flags": ["Priya Nair and Neha Gupta have overlapping time windows"]
        },
        "summary": "Transmitted 15-volunteer shift assignments for double-booking validation.",
        "status": "DELIVERED & EVALUATED",
        "latency": "15ms"
    },
    {
        "id": "msg-007",
        "timestamp": "11:04:04",
        "from_agent": "schedule",
        "from_name": "Schedule Agent",
        "to_agent": "conflict",
        "to_name": "Conflict Detection",
        "channel": "TIMETABLE_PROPOSAL",
        "topic": "Master Event Timetable Matrix",
        "payload": {
            "slots": 6,
            "time_span": "08:30 to 19:30",
            "critical_path_buffer": "30m"
        },
        "summary": "Proposed 6-slot master timetable for cross-domain constraint satisfaction audit.",
        "status": "DELIVERED & AUDITED",
        "latency": "20ms"
    },
    {
        "id": "msg-008",
        "timestamp": "11:05:14",
        "from_agent": "conflict",
        "from_name": "Conflict Detection",
        "to_agent": "readiness",
        "to_name": "Readiness Agent",
        "channel": "CONSTRAINT_AUDIT_REPORT",
        "topic": "Anomaly & Bottleneck Summary",
        "payload": {
            "active_conflicts": 2,
            "high_severity": 1,
            "medium_severity": 1,
            "auto_fixes_ready": 2
        },
        "summary": "Published constraint audit report (2 active collisions, 2 auto-fixes ready for dispatch).",
        "status": "DELIVERED & INGESTED",
        "latency": "25ms"
    },
    {
        "id": "msg-009",
        "timestamp": "11:06:05",
        "from_agent": "readiness",
        "from_name": "Readiness Agent",
        "to_agent": "all",
        "to_name": "Broadcast -> Central Command",
        "channel": "HEALTH_TELEMETRY_BROADCAST",
        "topic": "Composite Event Readiness Index",
        "payload": {
            "readiness_score": 92,
            "operational_status": "Nearly Ready",
            "blockers": ["Human Budget & Security Sign-off", "2 Unresolved Conflicts"]
        },
        "summary": "Broadcasted unified 92/100 readiness score and pre-flight checklist to central console.",
        "status": "BROADCAST SUCCESSFUL",
        "latency": "10ms"
    }
]

def log_inter_agent_message(from_agent, to_agent, channel, topic, payload, summary):
    from_name = next((a["name"] for a in AGENT_PROFILES if a["id"] == from_agent), from_agent)
    to_name = "Broadcast -> Central Command" if to_agent == "all" else next((a["name"] for a in AGENT_PROFILES if a["id"] == to_agent), to_agent)
    msg = {
        "id": f"msg-{len(INTER_AGENT_MESSAGES)+1:03d}",
        "timestamp": get_now_time(),
        "from_agent": from_agent,
        "from_name": from_name,
        "to_agent": to_agent,
        "to_name": to_name,
        "channel": channel,
        "topic": topic,
        "payload": payload,
        "summary": summary,
        "status": "DELIVERED & VERIFIED",
        "latency": "12ms"
    }
    INTER_AGENT_MESSAGES.insert(0, msg)
    if len(INTER_AGENT_MESSAGES) > 30:
        INTER_AGENT_MESSAGES.pop()
    return msg

# ─────────────────────────────────────────────
#  STATIC FILES
# ─────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(".", "agent.html")

# ─────────────────────────────────────────────
#  INTER-AGENT COMMUNICATIONS API
# ─────────────────────────────────────────────

@app.route("/api/agent-communications", methods=["GET"])
def get_agent_communications():
    agent_filter = request.args.get("agent_id")
    if agent_filter:
        res = [m for m in INTER_AGENT_MESSAGES if m["from_agent"] == agent_filter or m["to_agent"] in [agent_filter, "all"]]
        return jsonify(res)
    return jsonify(INTER_AGENT_MESSAGES)

@app.route("/api/agent-communications/test-ping", methods=["POST"])
def ping_inter_agent_communication():
    data = request.get_json(force=True) if request.data else {}
    from_agent = data.get("from_agent", "planner")
    to_agent = data.get("to_agent", "venue")
    channel = data.get("channel", "HEARTBEAT_SYNC_PING")
    topic = data.get("topic", "Inter-Agent Protocol Verification")
    
    msg = log_inter_agent_message(
        from_agent=from_agent,
        to_agent=to_agent,
        channel=channel,
        topic=topic,
        payload={"ping": "SYN", "pong": "ACK", "timestamp": get_now_time(), "protocol": "AgentMesh/2.0"},
        summary=f"Live protocol handshake packet transmitted from {from_agent.upper()} to {to_agent.upper()}."
    )
    add_agent_log(from_agent, "INFO", f"Transmitted inter-agent message to {to_agent.upper()} ({channel}).")
    add_agent_log(to_agent, "SYNC", f"Received message packet from {from_agent.upper()} (status: VERIFIED).")
    
    return jsonify({"success": True, "message": "Communication packet delivered", "packet": msg})

# ─────────────────────────────────────────────
#  ENRICHED AGENTS API
# ─────────────────────────────────────────────

@app.route("/api/agents", methods=["GET"])
def get_agents():
    res = []
    for a in AGENT_PROFILES:
        item = copy.deepcopy(a)
        item["state"] = agent_state[a["id"]]
        if a["id"] == "venue":
            item["live_summary"] = f"{len(VENUES)} venues confirmed • 830 seats total"
            item["data_count"] = len(VENUES)
        elif a["id"] == "resource":
            allocated_cnt = sum(r["allocated"] for r in RESOURCES)
            total_cnt = sum(r["available"] for r in RESOURCES)
            item["live_summary"] = f"{allocated_cnt}/{total_cnt} items allocated ({len(RESOURCES)} categories)"
            item["data_count"] = len(RESOURCES)
        elif a["id"] == "volunteer":
            item["live_summary"] = f"{len(VOLUNTEERS)} active staff • 4 teams deployed"
            item["data_count"] = len(VOLUNTEERS)
        elif a["id"] == "schedule":
            item["live_summary"] = f"{len(SCHEDULE)} timeline slots • 08:30 to 19:30"
            item["data_count"] = len(SCHEDULE)
        elif a["id"] == "conflict":
            open_c = len(active_conflicts())
            item["live_summary"] = f"{open_c} active conflict{'s' if open_c != 1 else ''}"
            item["data_count"] = open_c
        elif a["id"] == "readiness":
            item["live_summary"] = f"{readiness}/100 readiness index"
            item["data_count"] = readiness
        elif a["id"] == "planner":
            item["live_summary"] = f"{current_event['name']} • {current_event['participants']} attendees"
            item["data_count"] = current_event["participants"]
        res.append(item)
    return jsonify(res)

@app.route("/api/agents/<agent_id>", methods=["GET"])
def get_agent_details(agent_id):
    profile = next((a for a in AGENT_PROFILES if a["id"] == agent_id), None)
    if not profile:
        return jsonify({"error": "Agent not found"}), 404
    
    agent_info = copy.deepcopy(profile)
    agent_info["state"] = agent_state.get(agent_id, "idle")

    # Attach live connected domain data
    if agent_id == "planner":
        agent_info["connected_data"] = {
            "type": "planner",
            "event": current_event,
            "intake_prompt": "Organize a 2-day AI hackathon for 150 students. We need an auditorium, computer labs, projectors, 15 volunteers, lunch, judges and a closing ceremony."
        }
    elif agent_id == "venue":
        agent_info["connected_data"] = {
            "type": "venues",
            "venues": VENUES,
            "total_capacity": sum(v["capacity"] for v in VENUES)
        }
    elif agent_id == "resource":
        agent_info["connected_data"] = {
            "type": "resources",
            "resources": [{**r, "utilization": round(r["allocated"] / r["available"] * 100) if r["available"] else 0} for r in RESOURCES]
        }
    elif agent_id == "volunteer":
        agent_info["connected_data"] = {
            "type": "volunteers",
            "volunteers": VOLUNTEERS
        }
    elif agent_id == "schedule":
        agent_info["connected_data"] = {
            "type": "schedule",
            "schedule": SCHEDULE
        }
    elif agent_id == "conflict":
        agent_info["connected_data"] = {
            "type": "conflicts",
            "conflicts": active_conflicts()
        }
    elif agent_id == "readiness":
        checklist = [
            {"label": "Venue Assignment", "detail": f"{len(VENUES)} venues confirmed", "status": "READY", "ok": True},
            {"label": "Resource Logistics", "detail": f"{sum(r['allocated'] for r in RESOURCES)} items allocated", "status": "READY", "ok": True},
            {"label": "Volunteer Coverage", "detail": f"{len(VOLUNTEERS)} volunteers assigned", "status": "READY", "ok": True},
            {"label": "Conflict Resolution", "detail": f"{len(active_conflicts())} remaining", "status": "ACTION" if active_conflicts() else "READY", "ok": not active_conflicts()},
            {"label": "Admin Approvals", "detail": "Budget + Security approval", "status": "ACTION", "ok": False}
        ]
        agent_info["connected_data"] = {
            "type": "readiness",
            "score": readiness,
            "checklist": checklist
        }
    
    return jsonify(agent_info)

@app.route("/api/agents/<agent_id>/run", methods=["POST"])
def run_agent(agent_id):
    if agent_id not in agent_state:
        return jsonify({"error": "Agent not found"}), 404
    
    agent_state[agent_id] = "completed"
    
    # Specific agent action logs
    t = get_now_time()
    add_agent_log(agent_id, "INFO", f"Triggered execution pass at {t}.")
    add_agent_log(agent_id, "REASONING", f"Validating live domain state & updating dependent pipeline nodes.")
    add_agent_log(agent_id, "DECISION", f"Execution complete. Output state verified and broadcasted.")
    
    recalc_readiness()
    return jsonify({
        "id": agent_id,
        "state": "completed",
        "readiness": readiness,
        "message": f"Agent '{agent_id}' executed successfully."
    })

@app.route("/api/agents/run-all", methods=["POST"])
def run_all_agents():
    for a in AGENT_PROFILES:
        agent_state[a["id"]] = "completed"
        add_agent_log(a["id"], "INFO", f"Batch run execution finished at {get_now_time()}.")
    recalc_readiness()
    return jsonify({"message": "All agents completed", "states": agent_state, "readiness": readiness})

@app.route("/api/agents/reset", methods=["POST"])
def reset_agents():
    for a in AGENT_PROFILES:
        agent_state[a["id"]] = "idle"
        add_agent_log(a["id"], "INFO", "Agent state reset to idle.")
    return jsonify({"message": "All agents reset to idle"})

# ─────────────────────────────────────────────
#  VENUES & VOLUNTEERS APIS
# ─────────────────────────────────────────────

@app.route("/api/venues", methods=["GET"])
def get_venues():
    return jsonify(VENUES)

@app.route("/api/volunteers", methods=["GET"])
def get_volunteers():
    return jsonify(VOLUNTEERS)

# ─────────────────────────────────────────────
#  SCHEDULE API
# ─────────────────────────────────────────────

@app.route("/api/schedule", methods=["GET"])
def get_schedule():
    return jsonify(SCHEDULE)

# ─────────────────────────────────────────────
#  RESOURCES API
# ─────────────────────────────────────────────

@app.route("/api/resources", methods=["GET"])
def get_resources():
    return jsonify([{**r, "utilization": round(r["allocated"] / r["available"] * 100) if r["available"] else 0} for r in RESOURCES])

# ─────────────────────────────────────────────
#  CONFLICTS API
# ─────────────────────────────────────────────

@app.route("/api/conflicts", methods=["GET"])
def get_conflicts():
    return jsonify(active_conflicts())

@app.route("/api/conflicts/<int:conflict_id>/resolve", methods=["POST"])
def resolve_conflict(conflict_id):
    for c in conflicts:
        if c["id"] == conflict_id:
            c["resolved"] = True
            add_agent_log("conflict", "DECISION", f"Conflict #{conflict_id} ('{c['title']}') resolved via automated patch.")
            recalc_readiness()
            return jsonify({
                "message": f"Conflict {conflict_id} resolved",
                "readiness": readiness,
                "open_conflicts": len(active_conflicts())
            })
    return jsonify({"error": "Conflict not found"}), 404

@app.route("/api/conflicts/reset", methods=["POST"])
def reset_conflicts():
    global conflicts
    conflicts = copy.deepcopy(CONFLICT_TEMPLATES)
    recalc_readiness()
    return jsonify({"message": "Conflicts reset", "open_conflicts": len(active_conflicts())})

# ─────────────────────────────────────────────
#  TASKS API
# ─────────────────────────────────────────────

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    return jsonify(TASKS)

@app.route("/api/tasks/<int:task_id>/toggle", methods=["POST"])
def toggle_task(task_id):
    for t in TASKS:
        if t["id"] == task_id:
            t["completed"] = not t["completed"]
            recalc_readiness()
            return jsonify({**t, "readiness": readiness})
    return jsonify({"error": "Task not found"}), 404

@app.route("/api/tasks", methods=["POST"])
def add_task():
    data = request.get_json(force=True)
    new_id = max(t["id"] for t in TASKS) + 1 if TASKS else 1
    task = {
        "id": new_id,
        "name": data.get("name", "New Task"),
        "owner": data.get("owner", "Admin"),
        "agent_id": data.get("agent_id", "planner"),
        "completed": False,
        "deadline": data.get("deadline", "Today")
    }
    TASKS.append(task)
    return jsonify(task), 201

# ─────────────────────────────────────────────
#  EVENTS API
# ─────────────────────────────────────────────

@app.route("/api/event", methods=["GET"])
def get_event():
    return jsonify(current_event)

@app.route("/api/event", methods=["POST"])
def create_event():
    global current_event, conflicts, readiness
    data = request.get_json(force=True)
    current_event = {
        "id": current_event["id"] + 1,
        "name": data.get("name", "New Event"),
        "participants": int(data.get("participants", 100)),
        "duration": data.get("duration", "1 day"),
        "type": data.get("type", "Custom Event"),
        "venues": 4,
        "resources": 28,
        "volunteers": 15,
        "approvals": 2,
    }
    conflicts = copy.deepcopy(CONFLICT_TEMPLATES)
    for a in AGENT_PROFILES:
        agent_state[a["id"]] = "idle"
        add_agent_log(a["id"], "INFO", f"Initialized for newly created event '{current_event['name']}'.")
    readiness = 65
    return jsonify(current_event), 201

# ─────────────────────────────────────────────
#  PLAN GENERATION API
# ─────────────────────────────────────────────

@app.route("/api/plan/generate", methods=["POST"])
def generate_plan():
    data = request.get_json(force=True)
    text = data.get("requirements", "")
    participants = current_event["participants"]
    for word in text.split():
        if word.isdigit():
            n = int(word)
            if 10 <= n <= 5000:
                participants = n
                break
    
    current_event["participants"] = participants
    plan = {
        "event_type": "AI Hackathon & Build Sprint" if "hackathon" in text.lower() else "Custom Campus Event",
        "participants": participants,
        "duration": current_event["duration"],
        "venues_recommended": 4,
        "resources_required": max(20, participants // 5),
        "volunteers_required": max(10, participants // 10),
        "approvals_required": 2,
        "summary": f"Operational plan generated for: {text[:80]}",
    }
    add_agent_log("planner", "DECISION", f"Generated operational blueprint for {participants} participants.")
    return jsonify(plan)

# ─────────────────────────────────────────────
#  READINESS API
# ─────────────────────────────────────────────

@app.route("/api/readiness", methods=["GET"])
def get_readiness():
    recalc_readiness()
    checklist = [
        {"label": "Venue Assignment", "detail": f"{len(VENUES)} venues confirmed", "status": "READY", "ok": True},
        {"label": "Resource Logistics", "detail": f"{sum(r['allocated'] for r in RESOURCES)} items allocated", "status": "READY", "ok": True},
        {"label": "Volunteer Coverage", "detail": f"{len(VOLUNTEERS)} volunteers assigned", "status": "READY", "ok": True},
        {"label": "Conflict Resolution", "detail": f"{len(active_conflicts())} remaining", "status": "ACTION" if active_conflicts() else "READY", "ok": not active_conflicts()},
        {"label": "Admin Approvals", "detail": "Budget + Security approval", "status": "ACTION", "ok": False}
    ]
    return jsonify({"score": readiness, "checklist": checklist})

# ─────────────────────────────────────────────
#  REPLAN API
# ─────────────────────────────────────────────

@app.route("/api/replan", methods=["POST"])
def replan():
    global conflicts, readiness
    for c in conflicts:
        c["resolved"] = True
    readiness = 98
    for a in AGENT_PROFILES:
        agent_state[a["id"]] = "completed"
        add_agent_log(a["id"], "DECISION", "Dynamic replan optimization pass applied.")
    return jsonify({
        "message": "Replan complete — all constraints optimized",
        "readiness": readiness,
        "open_conflicts": 0,
        "agent_states": agent_state,
    })

# ─────────────────────────────────────────────
#  DASHBOARD API
# ─────────────────────────────────────────────

@app.route("/api/dashboard", methods=["GET"])
def dashboard():
    recalc_readiness()
    completed_agents = sum(1 for v in agent_state.values() if v == "completed")
    completed_tasks = sum(1 for t in TASKS if t["completed"])
    return jsonify({
        "readiness": readiness,
        "active_agents": f"{completed_agents} / {len(AGENT_PROFILES)}",
        "open_conflicts": len(active_conflicts()),
        "tasks": f"{completed_tasks} / {len(TASKS)}",
    })

# ─────────────────────────────────────────────
#  HEALTH CHECK
# ─────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "CampusAI Multi-Agent Backend"})

# ─────────────────────────────────────────────
#  LLM / GEMINI INTEGRATION
# ─────────────────────────────────────────────

def _get_gemini_client(api_key=None):
    """Initialize Gemini client. Priority: request key > env var."""
    if not GEMINI_AVAILABLE:
        return None, "google-genai package not installed. Run: pip install google-genai"
    key = (api_key or "").strip() or os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        return None, "No Gemini API key available. Set GEMINI_API_KEY in .env file."
    client = google_genai.Client(api_key=key)
    return client, None

def _build_event_context():
    """Build a rich context string from all live event data."""
    return f"""You are an intelligent AI assistant embedded inside CampusAI, a multi-agent campus event management system.

CURRENT EVENT: {current_event['name']}
- Type: {current_event['type']}
- Participants: {current_event['participants']}
- Duration: {current_event['duration']}
- Venues: {current_event['venues']}, Resources: {current_event['resources']}, Volunteers: {current_event['volunteers']}

VENUES ({len(VENUES)} confirmed):
{chr(10).join(f"  • {v['name']} — Capacity: {v['capacity']}, Status: {v['status']}, Assigned to: {v['assigned_to']}" for v in VENUES)}

SCHEDULE ({len(SCHEDULE)} slots):
{chr(10).join(f"  • {s['time']} ({s['duration']}) — {s['activity']} @ {s['venue']}" for s in SCHEDULE)}

VOLUNTEERS ({len(VOLUNTEERS)} staff):
{chr(10).join(f"  • {v['name']} — {v['role']}, Shift: {v['shift']}, Station: {v['assigned']}" for v in VOLUNTEERS)}

RESOURCES ({len(RESOURCES)} categories):
{chr(10).join(f"  • {r['name']}: {r['allocated']}/{r['available']} {r['unit']} ({r['category']})" for r in RESOURCES)}

ACTIVE CONFLICTS ({len(active_conflicts())}):
{chr(10).join(f"  • [{c['priority']}] {c['title']} — Fix: {c['recommended_fix']}" for c in active_conflicts()) or '  None'}

EVENT READINESS SCORE: {readiness}/100

Answer the user's question helpfully, concisely, and in the context of this specific campus event."""

@app.route("/api/llm/chat", methods=["POST"])
def llm_chat():
    """General AI assistant with full event context."""
    data = request.get_json(force=True)
    user_message = data.get("message", "").strip()
    chat_history = data.get("history", [])
    api_key = data.get("api_key", "")

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    client, err = _get_gemini_client(api_key)
    if err:
        return jsonify({"error": err}), 400

    try:
        system_context = _build_event_context()
        contents = []
        for msg in chat_history[-10:]:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})
        contents.append({"role": "user", "parts": [{"text": f"{system_context}\n\nUser question: {user_message}"}]})

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents
        )
        reply = response.text

        add_agent_log("planner", "INFO", f"LLM Chat answered: {user_message[:60]}...")
        return jsonify({"reply": reply, "model": "gemini-2.0-flash"})
    except Exception as e:
        return jsonify({"error": f"Gemini API error: {str(e)}"}), 500

@app.route("/api/llm/plan", methods=["POST"])
def llm_plan():
    """Generate a rich event plan using Gemini LLM."""
    data = request.get_json(force=True)
    requirements = data.get("requirements", "").strip()
    api_key = data.get("api_key", "")

    if not requirements:
        return jsonify({"error": "No requirements provided"}), 400

    client, err = _get_gemini_client(api_key)
    if err:
        return jsonify({"error": err}), 400

    try:
        prompt = f"""You are a campus event planning AI. Generate a detailed operational plan for the following event requirements.

Requirements: {requirements}

Provide a structured plan with these sections:
1. Event Summary (2-3 sentences)
2. Recommended Venues (list with capacity needs)
3. Required Resources & Equipment
4. Volunteer Staffing Plan (roles needed)
5. Suggested Timeline (key milestones)
6. Risk & Conflict Mitigation
7. Success Metrics

Be specific, practical, and campus-oriented. Format clearly with bullet points."""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        plan_text = response.text

        add_agent_log("planner", "DECISION", f"LLM generated operational blueprint for: {requirements[:60]}")
        return jsonify({"plan": plan_text, "model": "gemini-2.0-flash", "requirements": requirements})
    except Exception as e:
        return jsonify({"error": f"Gemini API error: {str(e)}"}), 500

@app.route("/api/llm/agent-ask", methods=["POST"])
def llm_agent_ask():
    """Chat with a specific agent backed by Gemini + agent's live data."""
    data = request.get_json(force=True)
    agent_id = data.get("agent_id", "planner")
    question = data.get("question", "").strip()
    api_key = data.get("api_key", "")

    if not question:
        return jsonify({"error": "No question provided"}), 400

    agent = next((a for a in AGENT_PROFILES if a["id"] == agent_id), None)
    if not agent:
        return jsonify({"error": "Agent not found"}), 404

    client, err = _get_gemini_client(api_key)
    if err:
        return jsonify({"error": err}), 400

    # Build agent-specific context
    agent_data_context = ""
    if agent_id == "venue":
        agent_data_context = "VENUES YOU MANAGE:\n" + "\n".join(
            f"  • {v['name']}: cap {v['capacity']}, {v['status']}, assigned to {v['assigned_to']}, equipment: {', '.join(v['equipment'])}"
            for v in VENUES
        )
    elif agent_id == "resource":
        agent_data_context = "RESOURCES YOU MANAGE:\n" + "\n".join(
            f"  • {r['name']}: {r['allocated']}/{r['available']} {r['unit']} at {r['location']}"
            for r in RESOURCES
        )
    elif agent_id == "volunteer":
        agent_data_context = "VOLUNTEERS YOU COORDINATE:\n" + "\n".join(
            f"  • {v['name']}: {v['role']}, shift {v['shift']}, at {v['assigned']}, status: {v['status']}"
            for v in VOLUNTEERS
        )
    elif agent_id == "schedule":
        agent_data_context = "SCHEDULE YOU GOVERN:\n" + "\n".join(
            f"  • {s['time']} ({s['duration']}): {s['activity']} @ {s['venue']}"
            for s in SCHEDULE
        )
    elif agent_id == "conflict":
        conflicts_list = active_conflicts()
        agent_data_context = (
            f"ACTIVE CONFLICTS YOU MONITOR ({len(conflicts_list)}):\n" +
            "\n".join(
                f"  • [{c['priority']}] {c['title']}: {c['description']} | Fix: {c['recommended_fix']}"
                for c in conflicts_list
            )
        ) if conflicts_list else "No active conflicts."
    elif agent_id == "readiness":
        agent_data_context = f"READINESS SCORE: {readiness}/100\nSCORE BREAKDOWN: Venue 100% | Resources 95% | Volunteers 100% | Conflicts: {len(active_conflicts())} open"
    elif agent_id == "planner":
        agent_data_context = f"EVENT: {current_event['name']} | {current_event['participants']} attendees | {current_event['duration']} | {current_event['type']}"

    full_prompt = f"""You are the {agent['name']} in the CampusAI multi-agent event management system.

Your role: {agent['role']}
Your description: {agent['description']}
Your system directive: {agent['system_prompt']}

LIVE DATA UNDER YOUR MANAGEMENT:
{agent_data_context}

EVENT READINESS: {readiness}/100 | OPEN CONFLICTS: {len(active_conflicts())}

A user is asking you directly. Answer in-character as this agent. Be helpful, specific, and use the actual live data above.

User question: {question}"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=full_prompt
        )
        reply = response.text

        add_agent_log(agent_id, "INFO", f"Agent answered LLM query: {question[:60]}")
        return jsonify({"reply": reply, "agent": agent["name"], "agent_id": agent_id, "model": "gemini-2.0-flash"})
    except Exception as e:
        return jsonify({"error": f"Gemini API error: {str(e)}"}), 500

# ─────────────────────────────────────────────
#  STATIC ASSETS SERVING
# ─────────────────────────────────────────────

@app.route("/<path:filename>", methods=["GET", "POST", "PUT", "DELETE"])
def serve_static_file(filename):
    # Don't shadow API routes
    if filename.startswith("api/"):
        from flask import abort
        abort(404)
    if os.path.exists(filename):
        return send_from_directory(".", filename)
    return jsonify({"error": f"File '{filename}' not found"}), 404

if __name__ == "__main__":
    print("=" * 55)
    print("  CampusAI — Python Flask Backend with Agent Connections")
    print("  Open: http://127.0.0.1:5000")
    print("=" * 55)
    app.run(debug=True, port=5000, use_reloader=False)
