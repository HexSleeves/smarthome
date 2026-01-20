#!/usr/bin/env python3
"""Persistent Roborock daemon for improved command performance.

This daemon maintains an MQTT connection and accepts commands via HTTP,
eliminating the overhead of spawning a new Python process for each command.

Usage:
    python roborock_daemon.py --port 9876

HTTP API:
    POST /init - Initialize MQTT connection with rriot credentials
    POST /command - Send command to a device
    GET /health - Health check
    POST /shutdown - Graceful shutdown
"""

import argparse
import asyncio
import json
import logging
import signal
import sys
from http import HTTPStatus
from typing import Any
from aiohttp import web

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    stream=sys.stderr
)
log = logging.getLogger(__name__)

try:
    from roborock import RRiot, Reference
    from roborock.protocol import create_mqtt_params, MessageParser
    from roborock.mqtt.roborock_session import RoborockMqttSession
    from roborock.roborock_message import RoborockMessageProtocol
    from roborock.protocols.v1_protocol import (
        RequestMessage,
        decode_rpc_response,
        create_security_data,
    )
    from roborock.exceptions import RoborockException
except ImportError as e:
    log.error(f"python-roborock not installed: {e}")
    sys.exit(1)


class RoborockDaemon:
    """Persistent daemon managing MQTT connections to Roborock devices."""

    def __init__(self):
        self.sessions: dict[str, RoborockMqttSession] = {}  # user_id -> session
        self.rriot_data: dict[str, RRiot] = {}  # user_id -> RRiot
        self.subscriptions: dict[str, dict[str, Any]] = {}  # user_id -> {device_id -> unsubscribe_fn}
        self.pending_responses: dict[str, asyncio.Future] = {}  # request_id -> Future
        self.request_counter = 0
        self._lock = asyncio.Lock()

    def _create_rriot(self, rriot_data: dict) -> RRiot:
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

    async def initialize(self, user_id: str, rriot_data: dict) -> dict[str, Any]:
        """Initialize MQTT session for a user."""
        async with self._lock:
            # Close existing session if any
            if user_id in self.sessions:
                await self._close_session(user_id)

            try:
                rriot = self._create_rriot(rriot_data)
                mqtt_params = create_mqtt_params(rriot)
                session = RoborockMqttSession(mqtt_params)
                await session.start()

                self.sessions[user_id] = session
                self.rriot_data[user_id] = rriot
                self.subscriptions[user_id] = {}

                log.info(f"Initialized MQTT session for user {user_id}")
                return {"success": True}
            except Exception as e:
                log.error(f"Failed to initialize session for {user_id}: {e}")
                return {"success": False, "error": str(e)}

    async def _close_session(self, user_id: str):
        """Close session for a user."""
        if user_id in self.subscriptions:
            for unsubscribe in self.subscriptions[user_id].values():
                if callable(unsubscribe):
                    unsubscribe()
            del self.subscriptions[user_id]

        if user_id in self.sessions:
            try:
                await self.sessions[user_id].close()
            except Exception as e:
                log.warning(f"Error closing session for {user_id}: {e}")
            del self.sessions[user_id]

        if user_id in self.rriot_data:
            del self.rriot_data[user_id]

    async def send_command(
        self,
        user_id: str,
        device_id: str,
        local_key: str,
        command: str,
        params: list | None = None,
    ) -> dict[str, Any]:
        """Send a command to a device."""
        session = self.sessions.get(user_id)
        rriot = self.rriot_data.get(user_id)

        if not session or not rriot:
            return {"success": False, "error": "Session not initialized. Call /init first."}

        try:
            mqtt_params = create_mqtt_params(rriot)

            # Create response future with unique ID
            self.request_counter += 1
            request_id = f"{user_id}:{device_id}:{self.request_counter}"
            response_future: asyncio.Future = asyncio.get_event_loop().create_future()
            self.pending_responses[request_id] = response_future

            def on_message(data: bytes):
                """Handle incoming MQTT message."""
                try:
                    messages, _ = MessageParser.parse(data, local_key)
                    for msg in messages:
                        if msg.protocol == RoborockMessageProtocol.RPC_RESPONSE:
                            response = decode_rpc_response(msg)
                            if request_id in self.pending_responses:
                                fut = self.pending_responses.pop(request_id)
                                if not fut.done():
                                    fut.set_result(response)
                except Exception as e:
                    log.warning(f"Error parsing message: {e}")
                    if request_id in self.pending_responses:
                        fut = self.pending_responses.pop(request_id)
                        if not fut.done():
                            fut.set_exception(e)

            # Subscribe to device topic if not already
            subscribe_topic = f"rr/m/o/{rriot.u}/{mqtt_params.username}/{device_id}"
            if device_id not in self.subscriptions.get(user_id, {}):
                unsubscribe = await session.subscribe(subscribe_topic, on_message)
                self.subscriptions.setdefault(user_id, {})[device_id] = unsubscribe
            else:
                # Update message handler for this request
                old_unsub = self.subscriptions[user_id].get(device_id)
                if callable(old_unsub):
                    old_unsub()
                unsubscribe = await session.subscribe(subscribe_topic, on_message)
                self.subscriptions[user_id][device_id] = unsubscribe

            # Create and send command
            security_data = create_security_data(rriot)
            request = RequestMessage(method=command, params=params or [])
            message = request.encode_message(
                protocol=RoborockMessageProtocol.RPC_REQUEST,
                security_data=security_data,
            )
            encoded = MessageParser.build(message, local_key, prefixed=False)

            publish_topic = f"rr/m/i/{rriot.u}/{mqtt_params.username}/{device_id}"
            await session.publish(publish_topic, encoded)

            log.info(f"Sent command {command} to device {device_id}")

            # Wait for response
            try:
                response = await asyncio.wait_for(response_future, timeout=30.0)
                if response.api_error:
                    return {"success": False, "error": str(response.api_error)}
                return {"success": True, "result": response.data}
            except asyncio.TimeoutError:
                self.pending_responses.pop(request_id, None)
                return {"success": False, "error": "Command timeout"}

        except RoborockException as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            log.error(f"Error sending command: {e}")
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    async def shutdown(self):
        """Shutdown all sessions."""
        log.info("Shutting down daemon...")
        user_ids = list(self.sessions.keys())
        for user_id in user_ids:
            await self._close_session(user_id)
        log.info("Daemon shutdown complete")


# Global daemon instance
daemon = RoborockDaemon()


async def handle_init(request: web.Request) -> web.Response:
    """Handle /init endpoint."""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        rriot = data.get("rriot")

        if not user_id or not rriot:
            return web.json_response(
                {"success": False, "error": "Missing user_id or rriot"},
                status=HTTPStatus.BAD_REQUEST
            )

        result = await daemon.initialize(user_id, rriot)
        return web.json_response(result)
    except json.JSONDecodeError:
        return web.json_response(
            {"success": False, "error": "Invalid JSON"},
            status=HTTPStatus.BAD_REQUEST
        )


async def handle_command(request: web.Request) -> web.Response:
    """Handle /command endpoint."""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        device_id = data.get("device_id")
        local_key = data.get("local_key")
        command = data.get("command")
        params = data.get("params")

        if not all([user_id, device_id, local_key, command]):
            return web.json_response(
                {"success": False, "error": "Missing required fields"},
                status=HTTPStatus.BAD_REQUEST
            )

        result = await daemon.send_command(user_id, device_id, local_key, command, params)
        return web.json_response(result)
    except json.JSONDecodeError:
        return web.json_response(
            {"success": False, "error": "Invalid JSON"},
            status=HTTPStatus.BAD_REQUEST
        )


async def handle_health(request: web.Request) -> web.Response:
    """Handle /health endpoint."""
    return web.json_response({
        "status": "ok",
        "active_sessions": len(daemon.sessions),
        "users": list(daemon.sessions.keys()),
    })


async def handle_shutdown(request: web.Request) -> web.Response:
    """Handle /shutdown endpoint."""
    await daemon.shutdown()
    # Schedule app stop
    asyncio.get_event_loop().call_soon(lambda: sys.exit(0))
    return web.json_response({"success": True})


async def handle_disconnect(request: web.Request) -> web.Response:
    """Handle /disconnect endpoint - disconnect a specific user."""
    try:
        data = await request.json()
        user_id = data.get("user_id")

        if not user_id:
            return web.json_response(
                {"success": False, "error": "Missing user_id"},
                status=HTTPStatus.BAD_REQUEST
            )

        await daemon._close_session(user_id)
        return web.json_response({"success": True})
    except json.JSONDecodeError:
        return web.json_response(
            {"success": False, "error": "Invalid JSON"},
            status=HTTPStatus.BAD_REQUEST
        )


def create_app() -> web.Application:
    """Create the aiohttp application."""
    app = web.Application()
    app.router.add_post("/init", handle_init)
    app.router.add_post("/command", handle_command)
    app.router.add_get("/health", handle_health)
    app.router.add_post("/shutdown", handle_shutdown)
    app.router.add_post("/disconnect", handle_disconnect)
    return app


async def run_server(port: int):
    """Run the HTTP server."""
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", port)
    await site.start()
    log.info(f"Roborock daemon listening on http://127.0.0.1:{port}")

    # Setup signal handlers
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(shutdown_handler(runner, loop)))

    # Keep running
    while True:
        await asyncio.sleep(3600)


async def shutdown_handler(runner: web.AppRunner, loop: asyncio.AbstractEventLoop):
    """Handle shutdown signals."""
    await daemon.shutdown()
    await runner.cleanup()
    loop.stop()


def main():
    parser = argparse.ArgumentParser(description="Roborock daemon")
    parser.add_argument("--port", type=int, default=9876, help="Port to listen on")
    args = parser.parse_args()

    try:
        asyncio.run(run_server(args.port))
    except KeyboardInterrupt:
        log.info("Interrupted")


if __name__ == "__main__":
    main()
