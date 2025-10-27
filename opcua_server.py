"""
OPC UA Server Core
Handles all OPC UA functionality with proper dropdown support
"""

from opcua import Server, ua
import threading
import time
import random
from datetime import datetime


class OPCUASimulator:
    """OPC UA Server with dynamic variable management"""
    
    def __init__(self, port=4840):
        self.server = None
        self.running = False
        self.port = port
        self.endpoint = f"opc.tcp://0.0.0.0:{port}"
        self.variables = {}
        self.history = {}
        self.sim_thread = None
    
    def setup_server(self, variables_config):
        """Setup OPC UA Server"""
        self.server = Server()
        self.server.set_endpoint(self.endpoint)
        self.server.set_server_name("OPC_UA_Simulator")
        self.server.set_security_policy([ua.SecurityPolicyType.NoSecurity])
        
        objects = self.server.get_objects_node()
        
        for var_name, var_config in variables_config.items():
            var_type = var_config['type']
            
            # Determine initial value
            if var_type == 'Numeric':
                if var_config['mode'] == 'Random':
                    initial_val = (var_config['min'] + var_config['max']) / 2
                else:
                    initial_val = var_config['constant']
                initial_val = round(initial_val, 2)
                
            elif var_type == 'String':
                if var_config.get('use_dropdown') and var_config.get('dropdown_options'):
                    # Use the configured value, or first option if value not set
                    initial_val = var_config.get('value', var_config['dropdown_options'][0])
                else:
                    initial_val = var_config.get('value', '')
                    
            elif var_type == 'Boolean':
                initial_val = var_config.get('value', False)
            else:
                initial_val = ""
            
            # Create OPC UA node
            node = objects.add_variable(0, var_name, initial_val)
            node.set_writable()
            
            self.variables[var_name] = {
                'node': node,
                'config': var_config.copy()
            }
            
            # Initialize history
            self.history[var_name] = {
                'timestamps': [],
                'values': []
            }
    
    def simulate_values(self):
        """Continuous simulation - only updates random numeric values"""
        current_values = {}
        
        while self.running:
            try:
                current_time = datetime.now()
                
                for var_name, var_data in self.variables.items():
                    config = var_data['config']
                    var_type = config['type']
                    
                    if var_type == 'Numeric' and config['mode'] == 'Random':
                        # Random numeric value - simulate smoothly
                        if var_name not in current_values:
                            current_values[var_name] = (config['min'] + config['max']) / 2
                        
                        range_size = config['max'] - config['min']
                        change = random.uniform(-1, 1) * range_size * 0.05
                        current_values[var_name] += change
                        current_values[var_name] = max(config['min'], 
                                                       min(config['max'], current_values[var_name]))
                        
                        rounded_val = round(current_values[var_name], 2)
                        var_data['node'].set_value(float(rounded_val))
                        
                        # Record history
                        self.history[var_name]['timestamps'].append(current_time)
                        self.history[var_name]['values'].append(rounded_val)
                        
                        if len(self.history[var_name]['timestamps']) > 100:
                            self.history[var_name]['timestamps'] = self.history[var_name]['timestamps'][-100:]
                            self.history[var_name]['values'] = self.history[var_name]['values'][-100:]
                    
                    else:
                        # For strings, constants, booleans - don't auto-change
                        # Just record current value to history
                        try:
                            current_val = var_data['node'].get_value()
                            self.history[var_name]['timestamps'].append(current_time)
                            self.history[var_name]['values'].append(current_val)
                            
                            if len(self.history[var_name]['timestamps']) > 100:
                                self.history[var_name]['timestamps'] = self.history[var_name]['timestamps'][-100:]
                                self.history[var_name]['values'] = self.history[var_name]['values'][-100:]
                        except Exception as e:
                            print(f"Error reading {var_name}: {e}")
                
                time.sleep(2)
                
            except Exception as e:
                print(f"Error in simulation: {e}")
                break
    
    def start(self, variables_config):
        """Start server"""
        try:
            self.setup_server(variables_config)
            self.server.start()
            self.running = True
            
            self.sim_thread = threading.Thread(target=self.simulate_values, daemon=True)
            self.sim_thread.start()
            
            print(f"✅ OPC UA Server started on {self.endpoint}")
            return True, "Server started successfully"
        except Exception as e:
            print(f"❌ Failed to start server: {e}")
            return False, str(e)
    
    def stop(self):
        """Stop server"""
        try:
            self.running = False
            if self.sim_thread:
                self.sim_thread.join(timeout=2)
            if self.server:
                self.server.stop()
            print("✅ OPC UA Server stopped")
            return True, "Server stopped successfully"
        except Exception as e:
            print(f"❌ Error stopping server: {e}")
            return False, str(e)
    
    def get_current_values(self):
        """Get all current values"""
        if not self.running:
            return {}
        
        values = {}
        try:
            for var_name, var_data in self.variables.items():
                values[var_name] = {
                    'value': var_data['node'].get_value(),
                    'type': var_data['config']['type'],
                    'config': var_data['config']
                }
        except Exception as e:
            print(f"Error getting values: {e}")
        
        return values
    
    def update_variable(self, var_name, value):
        """Update variable value"""
        if self.running and var_name in self.variables:
            try:
                var_type = self.variables[var_name]['config']['type']
                
                if var_type == 'Numeric':
                    self.variables[var_name]['node'].set_value(float(value))
                elif var_type == 'String':
                    self.variables[var_name]['node'].set_value(str(value))
                elif var_type == 'Boolean':
                    self.variables[var_name]['node'].set_value(bool(value))
                
                print(f"✅ Updated {var_name} = {value}")
                return True
            except Exception as e:
                print(f"❌ Error updating {var_name}: {e}")
                return False
        return False
