"""
Flask OPC UA Simulator - Complete Fixed Version
"""

from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO
from opcua_server import OPCUASimulator
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'opcua-secret-2025'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Global state
simulator = None
server_running = False
server_port = 4840
variables = {
    'Temperature': {
        'type': 'Numeric',
        'mode': 'Random',
        'min': 0.0,
        'max': 100.0,
        'constant': 0.0
    },
    'Pressure': {
        'type': 'Numeric',
        'mode': 'Random',
        'min': 0.0,
        'max': 50.0,
        'constant': 0.0
    },
    'Status': {
        'type': 'String',
        'value': 'Active',
        'use_dropdown': True,
        'dropdown_options': ['Active', 'Idle', 'Scheduled Down', 'Maintenance', 'Unscheduled Down']
    },
    'DeviceID': {
        'type': 'String',
        'value': 'DEVICE-1001',
        'use_dropdown': False,
        'dropdown_options': []
    }
}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/server/status')
def server_status():
    return jsonify({
        'running': server_running,
        'port': server_port,
        'variable_count': len(variables)
    })


@app.route('/api/server/start', methods=['POST'])
def start_server():
    global simulator, server_running
    
    if server_running:
        return jsonify({'success': False, 'message': 'Already running'})
    
    if len(variables) == 0:
        return jsonify({'success': False, 'message': 'Add variables first'})
    
    try:
        simulator = OPCUASimulator(port=server_port)
        success, message = simulator.start(variables)
        
        if success:
            server_running = True
            socketio.start_background_task(emit_updates)
            return jsonify({'success': True, 'message': 'Server started!'})
        else:
            return jsonify({'success': False, 'message': message})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@app.route('/api/server/stop', methods=['POST'])
def stop_server():
    global simulator, server_running
    
    if not server_running:
        return jsonify({'success': False, 'message': 'Not running'})
    
    try:
        success, message = simulator.stop()
        
        if success:
            server_running = False
            return jsonify({'success': True, 'message': 'Server stopped'})
        else:
            return jsonify({'success': False, 'message': message})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@app.route('/api/variables')
def get_variables():
    return jsonify(variables)


@app.route('/api/variables', methods=['POST'])
def add_variable():
    global variables
    
    data = request.json
    var_name = data.get('name')
    var_config = data.get('config')
    
    if not var_name:
        return jsonify({'success': False, 'message': 'Name required'})
    
    if var_name in variables:
        return jsonify({'success': False, 'message': 'Already exists'})
    
    if len(variables) >= 30:
        return jsonify({'success': False, 'message': 'Max 30 variables'})
    
    variables[var_name] = var_config
    return jsonify({'success': True, 'message': f'Added {var_name}'})


@app.route('/api/variables/<var_name>', methods=['DELETE'])
def delete_variable(var_name):
    global variables

    if server_running:
        return jsonify({'success': False, 'message': 'Stop server first'})

    if var_name in variables:
        del variables[var_name]
        return jsonify({'success': True, 'message': f'Deleted {var_name}'})
    return jsonify({'success': False, 'message': 'Not found'})

@app.route('/api/variables/<var_name>', methods=['PUT'])
def update_variable_config(var_name):
    global variables
    
    data = request.json
    
    if var_name not in variables:
        return jsonify({'success': False, 'message': 'Not found'})
    
    try:
        # Update the configuration
        variables[var_name].update(data)
        
        # If server is running, update OPC UA value immediately
        if server_running and simulator:
            var_type = variables[var_name].get('type')
            
            if var_type == 'Numeric':
                if variables[var_name].get('mode') == 'Constant' and 'constant' in data:
                    simulator.update_variable(var_name, float(data['constant']))
            
            elif var_type == 'String':
                if 'value' in data:
                    simulator.update_variable(var_name, str(data['value']))
            
            elif var_type == 'Boolean':
                if 'value' in data:
                    simulator.update_variable(var_name, bool(data['value']))
        
        return jsonify({'success': True, 'message': f'Updated {var_name}'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@app.route('/api/values')
def get_current_values():
    if not server_running or not simulator:
        return jsonify({})
    
    try:
        return jsonify(simulator.get_current_values())
    except Exception as e:
        print(f"Error getting values: {e}")
        return jsonify({})


@app.route('/api/history')
def get_history():
    if not server_running or not simulator:
        return jsonify([])
    
    try:
        history_data = []
        
        for var_name, hist in simulator.history.items():
            for timestamp, value in zip(hist['timestamps'], hist['values']):
                history_data.append({
                    'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                    'variable': var_name,
                    'value': value
                })
        
        history_data.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify(history_data[:200])
    except Exception as e:
        print(f"Error getting history: {e}")
        return jsonify([])


@app.route('/api/chart-data')
def get_chart_data():
    """Get chart data for numeric variables"""
    if not server_running or not simulator:
        return jsonify({})
    
    try:
        chart_data = {}
        
        for var_name, hist in simulator.history.items():
            var_config = variables.get(var_name, {})
            
            if var_config.get('type') == 'Numeric' and var_config.get('mode') == 'Random':
                if len(hist['timestamps']) > 1:
                    chart_data[var_name] = {
                        'labels': [t.strftime('%H:%M:%S') for t in hist['timestamps'][-50:]],
                        'data': hist['values'][-50:],
                        'min': var_config.get('min', 0),
                        'max': var_config.get('max', 100)
                    }
        
        return jsonify(chart_data)
    except Exception as e:
        print(f"Error getting chart data: {e}")
        return jsonify({})


@socketio.on('connect')
def handle_connect():
    print('✅ Client connected')


@socketio.on('disconnect')
def handle_disconnect():
    print('❌ Client disconnected')


def emit_updates():
    """Background thread for real-time updates"""
    while server_running:
        try:
            if simulator:
                values = simulator.get_current_values()
                if values:
                    socketio.emit('update_values', values)
            
            socketio.sleep(2)
        except Exception as e:
            print(f"Error in emit_updates: {e}")
            break


if __name__ == '__main__':
    print("\n" + "="*60)
    print("  🚀 OPC UA SIMULATOR")
    print("="*60)
    print("  URL: http://localhost:5000")
    print("  Variables: Temperature, Pressure, Status, DeviceID")
    print("  WebSocket: Enabled")
    print("="*60 + "\n")
    
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
