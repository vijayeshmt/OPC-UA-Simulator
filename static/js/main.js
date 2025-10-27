// Socket.IO connection
const socket = io();

// Global state
let currentTab = 'configuration';
let variables = {};
let serverRunning = false;
let charts = {};
let newVarDropdownOptions = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initConfiguration();
    initVariables();
    initMonitoring();
    loadVariables();
    updateServerStatus();
    
    socket.on('update_values', (values) => {
        updateMonitoringCards(values);
        updateChartsData(values);
    });
    
    setInterval(updateServerStatus, 5000);
});

// ============================================
// NAVIGATION
// ============================================
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchTab(item.dataset.tab));
    });
}

function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tab).classList.add('active');
    
    currentTab = tab;
    
    if (tab === 'charts') loadCharts();
    else if (tab === 'history') loadHistoryData();
    else if (tab === 'configuration-vars') loadConfigurationVars();
    else if (tab === 'monitoring' && serverRunning) fetchCurrentValues();
}

// ============================================
// CONFIGURATION
// ============================================
function initConfiguration() {
    document.getElementById('start-btn').addEventListener('click', startServer);
    document.getElementById('stop-btn').addEventListener('click', stopServer);
    document.getElementById('restart-btn').addEventListener('click', restartServer);
    document.getElementById('port-input').addEventListener('input', (e) => {
        document.getElementById('endpoint-display').textContent = `opc.tcp://localhost:${e.target.value}`;
    });
}

async function startServer() {
    const res = await fetch('/api/server/start', {method: 'POST'});
    const data = await res.json();
    if (data.success) {
        showToast('Server started!', 'success');
        updateServerStatus();
        setTimeout(() => { fetchCurrentValues(); loadCharts(); }, 2000);
    } else {
        showToast(data.message, 'error');
    }
}

async function stopServer() {
    const res = await fetch('/api/server/stop', {method: 'POST'});
    const data = await res.json();
    if (data.success) {
        showToast('Server stopped', 'info');
        updateServerStatus();
        clearMonitoringGrid();
        clearCharts();
        await loadVariables(); // <--- add this to refresh buttons and variable list
    } else {
        showToast(data.message, 'error');
    }
}


async function restartServer() {
    showToast('Restarting...', 'info');
    await stopServer();
    setTimeout(() => startServer(), 1500);
}

async function updateServerStatus() {
    const res = await fetch('/api/server/status');
    const data = await res.json();
    serverRunning = data.running;
    
    document.getElementById('status-text').textContent = data.running ? 'ONLINE' : 'OFFLINE';
    document.getElementById('status-icon').className = `status-dot ${data.running ? 'online' : 'offline'}`;
    document.getElementById('var-count').textContent = data.variable_count;
    
    document.getElementById('start-btn').disabled = data.running;
    document.getElementById('stop-btn').disabled = !data.running;
    document.getElementById('restart-btn').disabled = !data.running;
    
    const statusEl = document.getElementById('monitoring-status');
    if (statusEl) {
        statusEl.textContent = data.running ? '✅ Live data updating every 2 seconds' : '⚠️ Start server to see data';
        statusEl.style.color = data.running ? 'var(--secondary)' : 'var(--text-secondary)';
    }
}

// ============================================
// VARIABLES
// ============================================
function initVariables() {
    document.getElementById('add-var-btn').addEventListener('click', addVariable);
    document.getElementById('new-var-type').addEventListener('change', updateTypeConfigUI);
    document.getElementById('numeric-mode').addEventListener('change', toggleNumericMode);
    document.getElementById('use-dropdown').addEventListener('change', toggleDropdownConfig);
}

async function loadVariables() {
    const res = await fetch('/api/variables');
    variables = await res.json();
    renderVariablesList();
    document.getElementById('current-var-count').textContent = `${Object.keys(variables).length}/30`;
}

function renderVariablesList() {
    const list = document.getElementById('variables-list');
    list.innerHTML = '';
    
    Object.entries(variables).forEach(([name, config]) => {
        let modeText = '';
        if (config.type === 'Numeric') {
            modeText = config.mode === 'Random' ? `${config.min}-${config.max}` : `Const: ${config.constant}`;
        } else if (config.type === 'String' && config.use_dropdown) {
            modeText = `Dropdown (${config.dropdown_options.length} options)`;
        }
        
        const item = document.createElement('div');
        item.className = 'variable-item';
        item.innerHTML = `
            <div>
                <strong>${name}</strong>
                <span style="margin-left: 1rem; color: var(--text-secondary);">
                    ${config.type} ${modeText ? `• ${modeText}` : ''}
                </span>
            </div>
            <button onclick="deleteVariable('${name}')" ${serverRunning ? 'disabled' : ''}>Delete</button>
        `;
        list.appendChild(item);
    });
}

function updateTypeConfigUI() {
    const type = document.getElementById('new-var-type').value;
    document.getElementById('numeric-config').style.display = type === 'Numeric' ? 'block' : 'none';
    document.getElementById('string-config').style.display = type === 'String' ? 'block' : 'none';
    document.getElementById('boolean-config').style.display = type === 'Boolean' ? 'block' : 'none';
}

function toggleNumericMode() {
    const mode = document.getElementById('numeric-mode').value;
    document.getElementById('random-config').style.display = mode === 'Random' ? 'grid' : 'none';
    document.getElementById('constant-config').style.display = mode === 'Constant' ? 'block' : 'none';
}

function toggleDropdownConfig() {
    const useDropdown = document.getElementById('use-dropdown').checked;
    document.getElementById('dropdown-config').style.display = useDropdown ? 'block' : 'none';
    if (!useDropdown) {
        newVarDropdownOptions = [];
        renderNewVarDropdownList();
    }
}

function addNewVarDropdownOption() {
    const input = document.getElementById('new-dropdown-opt-input');
    const optionText = input.value.trim();
    
    if (!optionText) {
        showToast('Enter option text', 'error');
        return;
    }
    
    if (newVarDropdownOptions.includes(optionText)) {
        showToast('Option already exists', 'error');
        return;
    }
    
    newVarDropdownOptions.push(optionText);
    input.value = '';
    renderNewVarDropdownList();
    showToast('Option added', 'success');
}

function removeNewVarDropdownOption(index) {
    newVarDropdownOptions.splice(index, 1);
    renderNewVarDropdownList();
}

function renderNewVarDropdownList() {
    const container = document.getElementById('new-var-dropdown-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (newVarDropdownOptions.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem; font-style: italic;">No options added yet. Add at least one option above.</p>';
        return;
    }
    
    newVarDropdownOptions.forEach((opt, idx) => {
        const optDiv = document.createElement('div');
        optDiv.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-main); border-radius: 8px;';
        optDiv.innerHTML = `
            <span style="flex: 1; color: var(--text-primary);">${opt}</span>
            <button type="button" class="btn btn-secondary" onclick="removeNewVarDropdownOption(${idx})" style="padding: 0.5rem 0.75rem; min-width: auto;">
                <span class="material-icons" style="font-size: 1rem;">delete</span>
            </button>
        `;
        container.appendChild(optDiv);
    });
}

async function addVariable() {
    const name = document.getElementById('new-var-name').value.trim();
    const type = document.getElementById('new-var-type').value;
    
    if (!name) return showToast('Enter variable name', 'error');
    if (Object.keys(variables).length >= 30) return showToast('Max 30 variables', 'error');
    
    let config = {type};
    
    if (type === 'Numeric') {
        const mode = document.getElementById('numeric-mode').value;
        config.mode = mode;
        if (mode === 'Random') {
            const min = parseFloat(document.getElementById('var-min').value);
            const max = parseFloat(document.getElementById('var-max').value);
            if (min >= max) return showToast('Min < Max required', 'error');
            config.min = min;
            config.max = max;
            config.constant = 0;
        } else {
            config.constant = parseFloat(document.getElementById('var-constant').value);
            config.min = 0;
            config.max = 0;
        }
    } else if (type === 'String') {
        const useDropdown = document.getElementById('use-dropdown').checked;
        config.use_dropdown = useDropdown;
        
        if (useDropdown) {
            if (newVarDropdownOptions.length === 0) {
                return showToast('Add at least one dropdown option', 'error');
            }
            config.dropdown_options = [...newVarDropdownOptions];
            config.value = newVarDropdownOptions[0];
        } else {
            config.value = document.getElementById('string-value').value || '';
            config.dropdown_options = [];
        }
    } else if (type === 'Boolean') {
        config.value = document.getElementById('boolean-value').value === 'true';
    }
    
    const res = await fetch('/api/variables', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name, config})
    });
    
    const data = await res.json();
    if (data.success) {
        showToast(`${name} added!`, 'success');
        document.getElementById('new-var-name').value = '';
        newVarDropdownOptions = [];
        renderNewVarDropdownList();
        loadVariables();
    } else {
        showToast(data.message, 'error');
    }
}

async function deleteVariable(name) {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await fetch(`/api/variables/${name}`, {method: 'DELETE'});
    const data = await res.json();
    if (data.success) {
        showToast(`${name} deleted`, 'success');
        loadVariables();
    } else {
        showToast(data.message, 'error');
    }
}

function saveAllVariables() {
    showToast('Variables saved! Restart server to apply changes.', 'success');
}

// ============================================
// MONITORING
// ============================================
function initMonitoring() {
    const grid = document.getElementById('monitoring-grid');
    if (grid && typeof Sortable !== 'undefined') {
        new Sortable(grid, {animation: 200, ghostClass: 'sortable-ghost'});
    }
}

async function fetchCurrentValues() {
    const res = await fetch('/api/values');
    const values = await res.json();
    updateMonitoringCards(values);
}

function updateMonitoringCards(values) {
    const grid = document.getElementById('monitoring-grid');
    if (!grid) return;
    
    if (Object.keys(values).length === 0) {
        grid.innerHTML = '<p style="color: var(--text-secondary);">No data. Start server first.</p>';
        return;
    }
    
    // Check if we need to rebuild (different number of variables or first time)
    const currentCardCount = grid.querySelectorAll('.monitor-card').length;
    const newCardCount = Object.keys(values).length;
    
    if (currentCardCount !== newCardCount) {
        // Rebuild grid
        grid.innerHTML = '';
        Object.entries(values).forEach(([name, data]) => {
            grid.appendChild(createMonitorCard(name, data));
        });
        if (typeof Sortable !== 'undefined') {
            new Sortable(grid, {animation: 200, ghostClass: 'sortable-ghost'});
        }
    } else {
        // Just update existing cards
        Object.entries(values).forEach(([name, data]) => {
            const card = grid.querySelector(`[data-var="${name}"]`);
            if (card) {
                const valueEl = card.querySelector('.monitor-card-value');
                if (valueEl) valueEl.textContent = formatValue(data.value, data.type);
            }
        });
    }
}

function createMonitorCard(name, data) {
    const card = document.createElement('div');
    card.className = 'monitor-card';
    card.setAttribute('data-var', name);
    card.innerHTML = `
        <div class="monitor-card-header">
            <span class="material-icons">${getIconForType(data.type)}</span>
            <span>${name}</span>
        </div>
        <div class="monitor-card-value">${formatValue(data.value, data.type)}</div>
        <div class="monitor-card-meta">${data.type}${data.config.mode ? ` • ${data.config.mode}` : ''}</div>
    `;
    return card;
}

function clearMonitoringGrid() {
    const grid = document.getElementById('monitoring-grid');
    if (grid) {
        grid.innerHTML = '<p style="color: var(--text-secondary);">Server stopped. Start to see real-time data.</p>';
    }
}

function getIconForType(type) {
    return {Numeric: 'speed', String: 'text_fields', Boolean: 'toggle_on'}[type] || 'devices';
}

function formatValue(value, type) {
    if (type === 'Numeric') return typeof value === 'number' ? value.toFixed(2) : value;
    if (type === 'Boolean') return value ? '✓ True' : '✗ False';
    return value || 'N/A';
}
// ============================================
// VARIABLE CONFIGURATION
// ============================================
async function loadConfigurationVars() {
    const container = document.getElementById('config-vars-list');
    container.innerHTML = '';
    
    Object.entries(variables).forEach(([name, config]) => {
        const item = document.createElement('div');
        item.className = 'config-var-item';
        let html = `<h3>${name} (${config.type})</h3>`;
        
        if (config.type === 'Numeric') {
            if (config.mode === 'Random') {
                html += `
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Min Value</label>
                            <input type="number" value="${config.min}" id="min-${name}" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Max Value</label>
                            <input type="number" value="${config.max}" id="max-${name}" step="0.01">
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="saveVarConfig('${name}')">
                        <span class="material-icons">save</span>
                        Save Changes
                    </button>
                `;
            } else {
                html += `
                    <div class="form-group">
                        <label>Constant Value</label>
                        <input type="number" value="${config.constant}" id="const-${name}" step="0.01">
                    </div>
                    <button class="btn btn-primary" onclick="saveConstant('${name}')">
                        <span class="material-icons">save</span>
                        Save Changes
                    </button>
                `;
            }
        } else if (config.type === 'String') {
            if (config.use_dropdown) {
                html += `<p style="color: var(--text-secondary); margin-bottom: 1rem; font-weight: 500;">Dropdown Options (Edit, add, or select current value)</p>`;
                
                // Current value selector
                html += `
                    <div class="form-group" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-main); border-radius: 10px;">
                        <label style="font-weight: 600; color: var(--primary);">Currently Selected Value</label>
                        <select id="current-val-${name}" style="width: 100%; margin-top: 0.5rem;">
                `;
                config.dropdown_options.forEach((opt, idx) => {
                    const selected = opt === config.value ? 'selected' : '';
                    html += `<option value="${opt}" ${selected}>${opt}</option>`;
                });
                html += `
                        </select>
                        <button class="btn btn-primary" onclick="saveCurrentDropdownValue('${name}')" style="margin-top: 0.75rem; width: 100%;">
                            <span class="material-icons">check</span>
                            Set as Current Value
                        </button>
                    </div>
                `;
                
                html += `<p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.9rem;">Edit existing options below:</p>`;
                html += `<div id="dropdown-list-${name}" style="margin-bottom: 1.5rem;">`;
                
                config.dropdown_options.forEach((opt, idx) => {
                    html += `
                        <div class="form-group" style="display: flex; gap: 0.5rem; align-items: flex-end; margin-bottom: 0.75rem;">
                            <div style="flex: 1;">
                                <label>Option ${idx + 1}</label>
                                <input type="text" value="${opt}" id="opt-${name}-${idx}" style="width: 100%;">
                            </div>
                            <button class="btn btn-secondary" onclick="removeDropdownOption('${name}', ${idx})" style="padding: 0.75rem 1rem; min-width: auto;">
                                <span class="material-icons" style="font-size: 1.2rem;">delete</span>
                            </button>
                        </div>
                    `;
                });
                html += `</div>`;
                
                html += `
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Add New Option</label>
                        <input type="text" id="new-opt-${name}" placeholder="Enter new option">
                    </div>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <button class="btn" onclick="addDropdownOption('${name}')">
                            <span class="material-icons">add</span>
                            Add Option
                        </button>
                        <button class="btn btn-primary" onclick="saveDropdownOptions('${name}')">
                            <span class="material-icons">save</span>
                            Save All Options
                        </button>
                    </div>
                `;
            } else {
                html += `
                    <div class="form-group">
                        <label>String Value</label>
                        <input type="text" value="${config.value}" id="val-${name}">
                    </div>
                    <button class="btn btn-primary" onclick="saveStringValue('${name}')">
                        <span class="material-icons">save</span>
                        Save Changes
                    </button>
                `;
            }
        } else if (config.type === 'Boolean') {
            html += `
                <div class="form-group">
                    <label>Boolean Value</label>
                    <select id="bool-${name}">
                        <option value="true" ${config.value ? 'selected' : ''}>True</option>
                        <option value="false" ${!config.value ? 'selected' : ''}>False</option>
                    </select>
                </div>
                <button class="btn btn-primary" onclick="saveBooleanValue('${name}')">
                    <span class="material-icons">save</span>
                    Save Changes
                </button>
            `;
        }
        
        item.innerHTML = html;
        container.appendChild(item);
    });
}

async function saveVarConfig(varName) {
    const min = parseFloat(document.getElementById(`min-${varName}`).value);
    const max = parseFloat(document.getElementById(`max-${varName}`).value);
    if (min >= max) return showToast('Min < Max required', 'error');
    
    const res = await fetch(`/api/variables/${varName}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({min, max})
    });
    if ((await res.json()).success) {
        showToast('Saved! Restart server to apply.', 'success');
        loadVariables();
    }
}

async function saveConstant(varName) {
    const val = parseFloat(document.getElementById(`const-${varName}`).value);
    const res = await fetch(`/api/variables/${varName}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({constant: val})
    });
    if ((await res.json()).success) {
        showToast('Saved!', 'success');
        loadVariables();
    }
}

async function saveStringValue(varName) {
    const val = document.getElementById(`val-${varName}`).value;
    const res = await fetch(`/api/variables/${varName}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({value: val})
    });
    if ((await res.json()).success) {
        showToast('Saved!', 'success');
        loadVariables();
    }
}

async function saveBooleanValue(varName) {
    const val = document.getElementById(`bool-${varName}`).value === 'true';
    const res = await fetch(`/api/variables/${varName}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({value: val})
    });
    if ((await res.json()).success) {
        showToast('Saved!', 'success');
        loadVariables();
    }
}

// DROPDOWN FUNCTIONS
function addDropdownOption(varName) {
    const newOptInput = document.getElementById(`new-opt-${varName}`);
    const newOption = newOptInput.value.trim();
    
    if (!newOption) {
        showToast('Enter option text', 'error');
        return;
    }
    
    if (!variables[varName].dropdown_options) {
        variables[varName].dropdown_options = [];
    }
    
    variables[varName].dropdown_options.push(newOption);
    newOptInput.value = '';
    
    loadConfigurationVars();
    showToast('Option added! Click "Save All Options" to apply.', 'info');
}

function removeDropdownOption(varName, index) {
    if (!confirm('Remove this option?')) return;
    
    variables[varName].dropdown_options.splice(index, 1);
    loadConfigurationVars();
    showToast('Option removed! Click "Save All Options" to apply.', 'info');
}

async function saveDropdownOptions(varName) {
    const config = variables[varName];
    const updatedOptions = [];
    
    config.dropdown_options.forEach((opt, idx) => {
        const input = document.getElementById(`opt-${varName}-${idx}`);
        if (input && input.value.trim()) {
            updatedOptions.push(input.value.trim());
        }
    });
    
    if (updatedOptions.length === 0) {
        showToast('Add at least one option', 'error');
        return;
    }
    
    const res = await fetch(`/api/variables/${varName}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({dropdown_options: updatedOptions})
    });
    
    const data = await res.json();
    if (data.success) {
        showToast('Dropdown options saved! Restart server to apply.', 'success');
        loadVariables();
    } else {
        showToast(data.message, 'error');
    }
}

async function saveCurrentDropdownValue(varName) {
    const select = document.getElementById(`current-val-${varName}`);
    const selectedValue = select.value;
    
    const res = await fetch(`/api/variables/${varName}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({value: selectedValue})
    });
    
    const data = await res.json();
    if (data.success) {
        showToast('Current value updated! Changes will apply immediately if server is running.', 'success');
        loadVariables();
    } else {
        showToast(data.message, 'error');
    }
}

// ============================================
// CHARTS
// ============================================
async function loadCharts() {
    if (!serverRunning) {
        document.getElementById('charts-container').innerHTML = 
            '<p style="color: var(--text-secondary); font-size: 1.1rem;">Start server to see charts</p>';
        return;
    }
    
    const res = await fetch('/api/chart-data');
    const chartData = await res.json();
    const container = document.getElementById('charts-container');
    container.innerHTML = '';
    
    if (Object.keys(chartData).length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 1.1rem;">Waiting for data...</p>';
        return;
    }
    
    Object.entries(chartData).forEach(([varName, data]) => createChart(varName, data));
}

function createChart(varName, data) {
    const container = document.getElementById('charts-container');
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.innerHTML = `<h3>${varName} Trend</h3><canvas id="chart-${varName}"></canvas>`;
    container.appendChild(card);
    
    const ctx = document.getElementById(`chart-${varName}`).getContext('2d');
    if (charts[varName]) charts[varName].destroy();
    
    charts[varName] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: varName,
                data: data.data,
                borderColor: '#5e94ff',
                backgroundColor: 'rgba(94,148,255,0.2)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {legend: {labels: {color: '#e0e0e0'}}},
            scales: {
                y: {min: data.min, max: data.max, ticks: {color: '#a0a0b0'}, grid: {color: '#2a2a3e'}},
                x: {ticks: {color: '#a0a0b0'}, grid: {color: '#2a2a3e'}}
            }
        }
    });
}

function updateChartsData(values) {
    Object.entries(charts).forEach(([varName, chart]) => {
        if (values[varName]?.type === 'Numeric') {
            chart.data.labels.push(new Date().toLocaleTimeString());
            chart.data.datasets[0].data.push(values[varName].value);
            if (chart.data.labels.length > 50) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
            }
            chart.update('none');
        }
    });
}

function clearCharts() {
    Object.values(charts).forEach(c => c.destroy());
    charts = {};
}

// ============================================
// HISTORICAL DATA
// ============================================
async function loadHistoryData() {
    const res = await fetch('/api/history');
    const data = await res.json();
    const table = document.getElementById('history-table');
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    
    thead.innerHTML = '<th>Timestamp</th>';
    tbody.innerHTML = '';
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No data available</td></tr>';
        return;
    }
    
    const varNames = [...new Set(data.map(d => d.variable))];
    varNames.forEach(name => {
        const th = document.createElement('th');
        th.textContent = name;
        thead.appendChild(th);
    });
    
    const grouped = {};
    data.forEach(row => {
        if (!grouped[row.timestamp]) grouped[row.timestamp] = {timestamp: row.timestamp};
        grouped[row.timestamp][row.variable] = row.value;
    });
    
    Object.values(grouped).slice(0, 100).forEach(row => {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.textContent = row.timestamp;
        tr.appendChild(td);
        
        varNames.forEach(varName => {
            const td = document.createElement('td');
            const val = row[varName];
            td.textContent = val !== undefined ? (typeof val === 'number' ? val.toFixed(2) : val) : '-';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

document.getElementById('download-csv')?.addEventListener('click', async () => {
    const res = await fetch('/api/history');
    const data = await res.json();
    if (data.length === 0) return showToast('No data', 'error');
    
    const csv = 'Timestamp,Variable,Value\n' + data.map(r => `${r.timestamp},${r.variable},${r.value}`).join('\n');
    const blob = new Blob([csv], {type: 'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `opcua_history_${Date.now()}.csv`;
    a.click();
    showToast('Downloaded!', 'success');
});

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="material-icons">${{success:'check_circle',error:'error',info:'info'}[type]}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
