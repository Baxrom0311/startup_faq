"""Minimal FastAGI protocol implementation.

Asterisk's dialplan `AGI(agi://host:port/script)` app opens a plain TCP
connection to us per call and speaks a simple line protocol: on connect it
sends `agi_*: value` headers terminated by a blank line, then for every
command we write it replies with a single `200 result=...` line. No external
AGI library is used — the protocol is small enough to implement directly and
this avoids pulling in a dependency for a handful of commands.

Reference: https://docs.asterisk.org/Asterisk_18_Documentation/API_Documentation/AGI_Commands/
"""
import asyncio
import logging

logger = logging.getLogger(__name__)


class AGIError(Exception):
    pass


class AGIChannelHungUp(AGIError):
    """Raised when Asterisk reports the channel is gone (result=-1)."""


class AGISession:
    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter, env: dict[str, str]):
        self.reader = reader
        self.writer = writer
        self.env = env

    @classmethod
    async def read_handshake(cls, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> "AGISession":
        env: dict[str, str] = {}
        while True:
            line = await reader.readline()
            if not line or line in (b"\n", b"\r\n"):
                break
            decoded = line.decode("utf-8", errors="replace").strip()
            if ":" not in decoded:
                continue
            key, _, value = decoded.partition(":")
            env[key.strip()] = value.strip()
        return cls(reader, writer, env)

    async def _send(self, command: str) -> tuple[int, str]:
        self.writer.write((command + "\n").encode("utf-8"))
        await self.writer.drain()
        line = await self.reader.readline()
        if not line:
            raise AGIChannelHungUp("AGI connection closed by Asterisk")
        text = line.decode("utf-8", errors="replace").strip()
        # e.g. "200 result=1" or "200 result=-1 (timeout)"
        try:
            code = int(text.split(" ", 1)[0])
        except ValueError:
            code = 0
        result = 0
        if "result=" in text:
            raw = text.split("result=", 1)[1].split(" ", 1)[0]
            try:
                result = int(raw)
            except ValueError:
                result = 0
        if result == -1:
            raise AGIChannelHungUp(f"channel hung up during: {command}")
        return code, text

    async def answer(self) -> None:
        await self._send("ANSWER")

    async def verbose(self, message: str, level: int = 1) -> None:
        safe = message.replace('"', "'")
        await self._send(f'VERBOSE "{safe}" {level}')

    async def stream_file(self, filename_no_ext: str) -> None:
        """Play a sound file (must exist on the Asterisk host without extension)."""
        await self._send(f'STREAM FILE {filename_no_ext} ""')

    async def record_file(
        self,
        filename_no_ext: str,
        *,
        audio_format: str = "wav",
        timeout_ms: int = 12000,
        silence_seconds: int = 3,
        beep: bool = True,
    ) -> None:
        """Record caller audio until `silence_seconds` of silence or timeout."""
        beep_flag = "BEEP" if beep else ""
        await self._send(
            f'RECORD FILE {filename_no_ext} {audio_format} "#" {timeout_ms} 0 {beep_flag} s={silence_seconds}'
        )

    async def hangup(self) -> None:
        await self._send("HANGUP")

    def close(self) -> None:
        self.writer.close()
