OPC UA Simulator
================

Overview
--------
This project is a modern, fully configurable OPC UA Simulator with a user-friendly web UI, customizable variables, real-time monitoring, historical data, and charting. It is built with Flask (Python), OpenOPCUA, and a lightweight frontend.

Key Features:
- Add/edit/delete up to 30 variables (Numeric, Boolean, String with dropdown).
- Real-time monitoring of all variable values via web UI.
- Write variable values from any OPC UA client (UAExpert, Prosys, custom code, etc).
- Dynamic OPC UA address space (all variables are writable).
- Historical charting and CSV export.
- Dark mode and responsive design.

--------------------------
Quick Start
--------------------------
1. Clone the repository:
   git clone <your-repo-url>
   cd opcua_simulator

2. Install Python requirements:
   pip install -r requirements.txt
   (Python 3.8+ recommended)

3. Start the simulator server:
   python app.py

   - Web UI:        http://localhost:5000
   - OPC UA server: opc.tcp://localhost:4840  (customizable in UI)

--------------------------
Using the Simulator
--------------------------
1. Open http://localhost:5000 in your browser.
2. Use the sidebar to:
   - Start/stop the OPC UA server
   - Configure variables (add, remove, set min/max, constants, dropdowns)
   - Monitor live values and see historical graphs
   - Download data as CSV

3. Interact via OPC UA:
   - Connect with any OPC UA client (UAExpert, Prosys, custom scripts, etc).
   - The address space displays all configured variables (all are writable).
   - Write values using your client and see UI update instantly.


--------------------------
Project Structure
--------------------------
opcua_simulator/
├── app.py                 # Flask backend
├── opcua_server.py        # OPC UA server logic
├── requirements.txt
├── templates/
│   └── index.html         # Web UI (HTML)
└── static/
    ├── css/
    │   └── style.css
    └── js/
        └── main.js

