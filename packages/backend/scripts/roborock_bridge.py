#!/usr/bin/env python3
"""Bridge script for Roborock commands using python-roborock library.

This script provides a CLI interface for sending commands to Roborock devices.
It reads credentials from stdin as JSON and outputs results as JSON.

Usage:
    echo '{...}' | python roborock_bridge.py command
"""

import asyncio
import json
import sys
from typing import Any

try:
    from roborock import RRiot, Reference, UserData
    from roborock.protocol import create_mqtt_params
    from roborock.mqtt.roborock_session import RoborockMqttSession
    from roborock.devices.transport.mqtt_channel import MqttChannel
    from roborock.roborock_message import RoborockMessage, RoborockMessageProtocol
    from roborock.protocols.v1_protocol import (
        RequestMessage,
        decode_rpc_response,
        create_security_data,
    )
    from roborock.exceptions import RoborockException
except ImportError as e:
    print(json.dumps({"error": f"python-roborock not installed: {e}"}), file=sys.stdout)
    sys.exit(1)


def create_rriot(rriot_data: dict) -> RRiot:
    """Create RRiot object from dictionary."""
    ref = Reference(
        a=rriot_data["r"]["a"],
        m=rriot_data["r"].get("m"),
        l=rriot_data["r"].get("l"),
    )
    return RRiot(
        u=rriot_data["u"],
        s=rriot_data["s"],
        h=rriot_data["h"],
        k=rriot_data["k"],
        r=ref,
    )


async def send_mqtt_request(
    rriot: RRiot,
    device_id: str,
    local_key: str,
    command: str,
    params: list | None = None,
    timeout: float = 30.0,
) -> dict[str, Any]:
    """Send a request to a Roborock device via MQTT and wait for response."""
    mqtt_params = create_mqtt_params(rriot)
    session = RoborockMqttSession(mqtt_params)
    
    try:
        await session.start()
        
        # Create a simple response handler
        response_future: asyncio.Future = asyncio.get_event_loop().create_future()
        
        def on_message(data: bytes):
            """Handle incoming MQTT message."""
            try:
                from roborock.protocol import MessageParser
                messages, _ = MessageParser.parse(data, local_key)
                for msg in messages:
                    if msg.protocol == RoborockMessageProtocol.RPC_RESPONSE:
                        response = decode_rpc_response(msg)
                        if not response_future.done():
                            response_future.set_result(response)
            except Exception as e:
                if not response_future.done():
                    response_future.set_exception(e)
        
        # Subscribe to device topic
        subscribe_topic = f"rr/m/o/{rriot.u}/{mqtt_params.username}/{device_id}"
        unsubscribe = await session.subscribe(subscribe_topic, on_message)
        
        # Create and send the command
        security_data = create_security_data(rriot)
        request = RequestMessage(method=command, params=params or [])
        message = request.encode_message(
            protocol=RoborockMessageProtocol.RPC_REQUEST,
            security_data=security_data,
        )
        
        # Encode the message
        from roborock.protocol import MessageParser
        encoded = MessageParser.build(message, local_key, prefixed=False)
        
        # Publish to device topic
        publish_topic = f"rr/m/i/{rriot.u}/{mqtt_params.username}/{device_id}"
        await session.publish(publish_topic, encoded)
        
        # Wait for response with timeout
        try:
            response = await asyncio.wait_for(response_future, timeout=timeout)
            unsubscribe()
            
            if response.api_error:
                return {"success": False, "error": str(response.api_error)}
            
            return {"success": True, "result": response.data}
        except asyncio.TimeoutError:
            unsubscribe()
            return {"success": False, "error": "Command timeout"}
            
    except RoborockException as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {str(e)}"}
    finally:
        await session.close()


async def get_device_status(
    rriot: RRiot,
    device_id: str,
    local_key: str,
) -> dict[str, Any]:
    """Get the current status of a Roborock device."""
    result = await send_mqtt_request(
        rriot, device_id, local_key, "get_status", timeout=15.0
    )
    
    if result.get("success") and result.get("result"):
        # Parse status into a more friendly format
        raw_status = result["result"]
        if isinstance(raw_status, list) and len(raw_status) > 0:
            raw_status = raw_status[0]
        
        return {
            "success": True,
            "status": raw_status,
        }
    
    return result


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: roborock_bridge.py <action>"}), file=sys.stdout)
        sys.exit(1)
    
    action = sys.argv[1]
    
    # Read input from stdin
    try:
        input_data = json.loads(sys.stdin.read())
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {str(e)}"}), file=sys.stdout)
        sys.exit(1)
    
    # Validate required fields
    if "rriot" not in input_data:
        print(json.dumps({"error": "Missing 'rriot' in input"}), file=sys.stdout)
        sys.exit(1)
    
    try:
        rriot = create_rriot(input_data["rriot"])
    except KeyError as e:
        print(json.dumps({"error": f"Missing rriot field: {str(e)}"}), file=sys.stdout)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Failed to create rriot: {str(e)}"}), file=sys.stdout)
        sys.exit(1)
    
    if action == "command":
        if "device_id" not in input_data:
            print(json.dumps({"error": "Missing 'device_id' for command"}), file=sys.stdout)
            sys.exit(1)
        if "local_key" not in input_data:
            print(json.dumps({"error": "Missing 'local_key' for command"}), file=sys.stdout)
            sys.exit(1)
        if "command" not in input_data:
            print(json.dumps({"error": "Missing 'command' for command action"}), file=sys.stdout)
            sys.exit(1)
        
        result = asyncio.run(send_mqtt_request(
            rriot,
            input_data["device_id"],
            input_data["local_key"],
            input_data["command"],
            input_data.get("params"),
        ))
        print(json.dumps(result), file=sys.stdout)
    
    elif action == "get_status":
        if "device_id" not in input_data:
            print(json.dumps({"error": "Missing 'device_id' for get_status"}), file=sys.stdout)
            sys.exit(1)
        if "local_key" not in input_data:
            print(json.dumps({"error": "Missing 'local_key' for get_status"}), file=sys.stdout)
            sys.exit(1)
        
        result = asyncio.run(get_device_status(
            rriot,
            input_data["device_id"],
            input_data["local_key"],
        ))
        print(json.dumps(result), file=sys.stdout)
    
    else:
        print(json.dumps({"error": f"Unknown action: {action}"}), file=sys.stdout)
        sys.exit(1)


if __name__ == "__main__":
    main()
