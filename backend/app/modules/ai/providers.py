from __future__ import annotations

import hashlib
import json
import logging
import math
import re
import tempfile
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, Protocol

import httpx
from pydantic import ValidationError

from app.core.config import settings
from app.modules.ai.schemas import StructuredProblem
from app.modules.media.service import download_media_object

LLM_PROMPT_VERSION = "problem-structuring-v2"
LLM_SCHEMA_KEYS = [
    "title",
    "summary",
    "who_affected",
    "frequency",
    "current_workaround",
    "pain_level",
    "urgency",
    "impact_scope",
    "suggested_sector",
    "suggested_region",
    "tags",
    "duplicate_keywords",
    "is_actionable",
    "confidence",
    "flags",
    "moderation_reason",
]
logger = logging.getLogger(__name__)


class STTProvider(Protocol):
    name: str

    async def transcribe(self, object_key: str) -> str:
        pass


class LLMProvider(Protocol):
    name: str

    async def structure_problem(self, text: str, *, has_audio: bool) -> StructuredProblem:
        pass


class EmbeddingProvider(Protocol):
    name: str

    async def embed(self, text: str) -> list[float]:
        pass


def _compact_text(text: str) -> str:
    return " ".join(text.split())


def _title(text: str, *, has_audio: bool) -> str:
    compact = _compact_text(text)
    if not compact:
        return "Audio muammo" if has_audio else "Nomsiz muammo"
    return compact if len(compact) <= 90 else f"{compact[:87].rstrip()}..."


def _summary(text: str) -> str:
    compact = _compact_text(text)
    return compact if len(compact) <= 260 else f"{compact[:257].rstrip()}..."


def _tags(text: str) -> list[str]:
    normalized = text.casefold()
    candidates = {
        "agro": ["issiqxona", "fermer", "hosil", "suv", "tomorqa"],
        "ta'lim": ["maktab", "o'quv", "talaba", "dars", "ustoz"],
        "tibbiyot": ["shifokor", "klinika", "dorixona", "bemor"],
        "logistika": ["yetkaz", "transport", "ombor", "yo'l"],
    }
    tags: list[str] = []
    for tag, words in candidates.items():
        if any(word in normalized for word in words):
            tags.append(tag)
    return tags[:5]


def _structure_prompt(text: str) -> str:
    return (
        f"Prompt version: {LLM_PROMPT_VERSION}\n"
        "You are a senior product analyst for a problem-to-solution marketplace. "
        "Your job is to transform raw user pain into a concise, buildable challenge statement. "
        "Return only one valid JSON object. No markdown, no prose outside JSON.\n\n"
        f"Required keys: {', '.join(LLM_SCHEMA_KEYS)}.\n"
        "Rules:\n"
        "- Use Uzbek when the input is Uzbek; keep names/places as written.\n"
        "- title: concrete, max 90 chars, no clickbait.\n"
        "- summary: 1-3 sentences, specific enough for builders.\n"
        "- pain_level: integer 1-5 or null.\n"
        "- urgency: one of low, medium, high, critical, or null.\n"
        "- impact_scope: individual, local, regional, national, or null.\n"
        "- tags and duplicate_keywords: lowercase short terms, max 8 items.\n"
        "- confidence: number from 0 to 1.\n"
        "- flags: boolean map with keys spam, toxic, not_a_problem, unsafe, needs_review.\n"
        "- moderation_reason: short reason when needs_review/not_a_problem/spam/toxic/unsafe is true; otherwise null.\n\n"
        f"Problem:\n{text}"
    )


def _extract_json_object(raw_value: str) -> dict[str, Any]:
    cleaned = raw_value.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end >= start:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


def _normalize_string(value: object, *, max_length: int | None = None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    if max_length and len(normalized) > max_length:
        return f"{normalized[: max_length - 3].rstrip()}..."
    return normalized


def _normalize_tags(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    tags: list[str] = []
    for item in value:
        normalized = re.sub(r"\s+", "-", str(item).casefold().strip())
        normalized = re.sub(r"[^\w'-]+", "", normalized)
        if normalized and normalized not in tags:
            tags.append(normalized)
    return tags[:8]


def _normalize_flags(value: object) -> dict[str, bool]:
    flags = {
        "spam": False,
        "toxic": False,
        "not_a_problem": False,
        "unsafe": False,
        "needs_review": False,
    }
    if isinstance(value, dict):
        for key, flag_value in value.items():
            flags[str(key)] = bool(flag_value)
    return flags


def _clamp_pain_level(value: object) -> int | None:
    if value is None:
        return None
    try:
        return max(1, min(5, int(value)))
    except (TypeError, ValueError):
        return None


def _clamp_confidence(value: object, *, default: float) -> float:
    try:
        return max(0, min(1, float(value)))
    except (TypeError, ValueError):
        return default


def _clean_structured_data(data: dict[str, Any], text: str, *, has_audio: bool) -> dict[str, Any]:
    has_text = bool(text.strip())
    flags = _normalize_flags(data.get("flags"))
    if not has_text:
        flags["not_a_problem"] = True
        flags["needs_review"] = True
    if flags.get("spam") or flags.get("toxic") or flags.get("unsafe"):
        flags["needs_review"] = True

    cleaned = {
        "title": _normalize_string(data.get("title"), max_length=120) or _title(text, has_audio=has_audio),
        "summary": _normalize_string(data.get("summary")) or _summary(text),
        "who_affected": _normalize_string(data.get("who_affected")),
        "frequency": _normalize_string(data.get("frequency")),
        "current_workaround": _normalize_string(data.get("current_workaround")),
        "pain_level": _clamp_pain_level(data.get("pain_level")),
        "urgency": _normalize_string(data.get("urgency"), max_length=32),
        "impact_scope": _normalize_string(data.get("impact_scope"), max_length=32),
        "suggested_sector": _normalize_string(data.get("suggested_sector"), max_length=80),
        "suggested_region": _normalize_string(data.get("suggested_region"), max_length=120),
        "tags": _normalize_tags(data.get("tags")),
        "duplicate_keywords": _normalize_tags(data.get("duplicate_keywords")),
        "is_actionable": bool(data.get("is_actionable", has_text)) and has_text,
        "confidence": _clamp_confidence(data.get("confidence"), default=0.6 if has_text else 0.2),
        "flags": flags,
        "moderation_reason": _normalize_string(data.get("moderation_reason"), max_length=240),
    }
    if flags["needs_review"] and not cleaned["moderation_reason"]:
        cleaned["moderation_reason"] = "AI review required"
    return cleaned


def _validate_structured_data(data: dict[str, Any], text: str, *, has_audio: bool) -> StructuredProblem:
    cleaned = _clean_structured_data(data, text, has_audio=has_audio)
    try:
        return StructuredProblem.model_validate(cleaned)
    except ValidationError:
        logger.exception("Structured LLM output failed validation; using deterministic fallback")
        return DeterministicLLMProvider().structure_problem_sync(text, has_audio=has_audio)


async def _with_retry(operation: Callable[[], Awaitable[httpx.Response]]) -> httpx.Response:
    last_error: Exception | None = None
    for _attempt in range(3):
        try:
            response = await operation()
            if response.status_code not in {408, 409, 425, 429, 500, 502, 503, 504}:
                response.raise_for_status()
                return response
            response.raise_for_status()
        except (httpx.HTTPError, httpx.TimeoutException) as error:
            last_error = error
    if last_error:
        raise last_error
    raise RuntimeError("LLM provider request failed")


class NoopSTTProvider:
    name = "noop-stt"

    async def transcribe(self, object_key: str) -> str:
        _ = object_key
        return ""


class WhisperLocalSTTProvider:
    name = "whisper-local-stt"

    async def transcribe(self, object_key: str) -> str:
        try:
            from faster_whisper import WhisperModel
        except ImportError:
            return ""

        suffix = Path(object_key).suffix or ".audio"
        with tempfile.NamedTemporaryFile(suffix=suffix) as media_file:
            download_media_object(
                object_key=object_key,
                destination_path=media_file.name,
            )
            model = WhisperModel(
                settings.WHISPER_MODEL,
                device=settings.WHISPER_DEVICE,
                compute_type=settings.WHISPER_COMPUTE_TYPE,
            )
            segments, _ = model.transcribe(
                media_file.name,
                language=settings.STT_LANGUAGE or None,
            )
            return " ".join(segment.text.strip() for segment in segments).strip()


class ApiSTTProvider:
    name = "api-stt"

    async def transcribe(self, object_key: str) -> str:
        if not settings.STT_API_URL:
            return ""

        suffix = Path(object_key).suffix or ".audio"
        with tempfile.NamedTemporaryFile(suffix=suffix) as media_file:
            download_media_object(
                object_key=object_key,
                destination_path=media_file.name,
            )
            with open(media_file.name, "rb") as opened_file:
                async with httpx.AsyncClient(timeout=120) as client:
                    response = await client.post(
                        settings.STT_API_URL,
                        data={"language": settings.STT_LANGUAGE},
                        files={
                            "file": (
                                Path(object_key).name,
                                opened_file,
                                "application/octet-stream",
                            )
                        },
                    )
                    response.raise_for_status()

        payload = response.json()
        transcript = payload.get("text") or payload.get("transcript") or ""
        return str(transcript).strip()


class DeterministicLLMProvider:
    name = "deterministic-llm"

    def structure_problem_sync(self, text: str, *, has_audio: bool) -> StructuredProblem:
        compact = _compact_text(text)
        has_text = bool(compact)
        tags = _tags(compact)
        return StructuredProblem(
            title=_title(compact, has_audio=has_audio),
            summary=_summary(compact),
            who_affected=None,
            frequency=None,
            current_workaround=None,
            pain_level=3 if has_text else None,
            urgency="medium" if has_text else None,
            impact_scope=None,
            suggested_sector=tags[0] if tags else None,
            suggested_region=None,
            tags=tags,
            duplicate_keywords=tags,
            is_actionable=has_text,
            confidence=0.72 if has_text else 0.2,
            flags={
                "spam": False,
                "toxic": False,
                "not_a_problem": not has_text,
                "unsafe": False,
                "needs_review": has_audio and not has_text,
                "needs_transcript": has_audio and not has_text,
            },
            moderation_reason="Transcript required" if has_audio and not has_text else None,
        )

    async def structure_problem(self, text: str, *, has_audio: bool) -> StructuredProblem:
        return self.structure_problem_sync(text, has_audio=has_audio)


class OllamaLLMProvider:
    name = "ollama-llm"

    async def structure_problem(self, text: str, *, has_audio: bool) -> StructuredProblem:
        if not text.strip():
            return await DeterministicLLMProvider().structure_problem(text, has_audio=has_audio)
        async with httpx.AsyncClient(timeout=45) as client:
            response = await _with_retry(
                lambda: client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": _structure_prompt(text),
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0.1},
                    },
                )
            )
        payload = response.json()
        raw_json = payload.get("response", "{}")
        return _validate_structured_data(_extract_json_object(raw_json), text, has_audio=has_audio)


class OpenAILLMProvider:
    name = "openai-llm"

    async def structure_problem(self, text: str, *, has_audio: bool) -> StructuredProblem:
        if not settings.OPENAI_API_KEY or not text.strip():
            return await DeterministicLLMProvider().structure_problem(text, has_audio=has_audio)
        async with httpx.AsyncClient(timeout=60) as client:
            response = await _with_retry(
                lambda: client.post(
                    "https://api.openai.com/v1/responses",
                    headers={
                        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.OPENAI_MODEL,
                        "input": _structure_prompt(text),
                        "text": {"format": {"type": "json_object"}},
                    },
                )
            )
        payload = response.json()
        raw_text = payload.get("output_text")
        if not raw_text:
            raw_text = "".join(
                content.get("text", "")
                for item in payload.get("output", [])
                for content in item.get("content", [])
                if content.get("type") in {"output_text", "text"}
            )
        return _validate_structured_data(_extract_json_object(raw_text or "{}"), text, has_audio=has_audio)


class AnthropicLLMProvider:
    name = "anthropic-llm"

    async def structure_problem(self, text: str, *, has_audio: bool) -> StructuredProblem:
        if not settings.ANTHROPIC_API_KEY or not text.strip():
            return await DeterministicLLMProvider().structure_problem(text, has_audio=has_audio)
        async with httpx.AsyncClient(timeout=60) as client:
            response = await _with_retry(
                lambda: client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": settings.ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.ANTHROPIC_MODEL,
                        "max_tokens": 1200,
                        "temperature": 0.1,
                        "messages": [
                            {
                                "role": "user",
                                "content": _structure_prompt(text),
                            }
                        ],
                    },
                )
            )
        payload = response.json()
        raw_text = "".join(
            block.get("text", "")
            for block in payload.get("content", [])
            if block.get("type") == "text"
        )
        return _validate_structured_data(_extract_json_object(raw_text), text, has_audio=has_audio)


class DeepSeekLLMProvider:
    name = "deepseek-llm"

    async def structure_problem(self, text: str, *, has_audio: bool) -> StructuredProblem:
        if not settings.DEEPSEEK_API_KEY or not text.strip():
            return await DeterministicLLMProvider().structure_problem(text, has_audio=has_audio)
        async with httpx.AsyncClient(timeout=60) as client:
            response = await _with_retry(
                lambda: client.post(
                    f"{settings.DEEPSEEK_BASE_URL.rstrip('/')}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.DEEPSEEK_MODEL,
                        "messages": [
                            {
                                "role": "system",
                                "content": "Return only valid JSON. No markdown.",
                            },
                            {
                                "role": "user",
                                "content": _structure_prompt(text),
                            },
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.1,
                    },
                )
            )
        payload = response.json()
        raw_text = (
            payload.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "{}")
        )
        return _validate_structured_data(_extract_json_object(raw_text), text, has_audio=has_audio)


class GeminiLLMProvider:
    name = "gemini-llm"

    async def structure_problem(self, text: str, *, has_audio: bool) -> StructuredProblem:
        if not settings.GEMINI_API_KEY or not text.strip():
            return await DeterministicLLMProvider().structure_problem(text, has_audio=has_audio)
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.GEMINI_MODEL}:generateContent"
        )
        async with httpx.AsyncClient(timeout=60) as client:
            response = await _with_retry(
                lambda: client.post(
                    url,
                    params={"key": settings.GEMINI_API_KEY},
                    json={
                        "contents": [
                            {
                                "role": "user",
                                "parts": [{"text": _structure_prompt(text)}],
                            }
                        ],
                        "generationConfig": {
                            "responseMimeType": "application/json",
                            "temperature": 0.1,
                        },
                    },
                )
            )
        payload = response.json()
        raw_text = "".join(
            part.get("text", "")
            for candidate in payload.get("candidates", [])
            for part in candidate.get("content", {}).get("parts", [])
        )
        return _validate_structured_data(_extract_json_object(raw_text), text, has_audio=has_audio)


class HashEmbeddingProvider:
    name = "hash-embedding-v1"
    dimensions = 64

    async def embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        tokens = re.findall(r"\w+", text.casefold())
        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:2], "big") % self.dimensions
            sign = 1 if digest[2] % 2 == 0 else -1
            vector[index] += sign
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            return vector
        return [round(value / norm, 6) for value in vector]


class OpenAIEmbeddingProvider:
    name = "openai-embedding"

    async def embed(self, text: str) -> list[float]:
        if not settings.OPENAI_API_KEY or not text.strip():
            return await HashEmbeddingProvider().embed(text)
        async with httpx.AsyncClient(timeout=45) as client:
            response = await _with_retry(
                lambda: client.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.EMBEDDING_MODEL,
                        "input": text,
                    },
                )
            )
        payload = response.json()
        embedding = payload.get("data", [{}])[0].get("embedding", [])
        return [float(value) for value in embedding]


class GeminiEmbeddingProvider:
    name = "gemini-embedding"

    async def embed(self, text: str) -> list[float]:
        if not settings.GEMINI_API_KEY or not text.strip():
            return await HashEmbeddingProvider().embed(text)
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.EMBEDDING_MODEL}:embedContent"
        )
        async with httpx.AsyncClient(timeout=45) as client:
            response = await _with_retry(
                lambda: client.post(
                    url,
                    params={"key": settings.GEMINI_API_KEY},
                    json={"content": {"parts": [{"text": text}]}},
                )
            )
        payload = response.json()
        embedding = payload.get("embedding", {}).get("values", [])
        return [float(value) for value in embedding]


class OllamaEmbeddingProvider:
    name = "ollama-embedding"

    async def embed(self, text: str) -> list[float]:
        if not text.strip():
            return await HashEmbeddingProvider().embed(text)
        async with httpx.AsyncClient(timeout=45) as client:
            response = await _with_retry(
                lambda: client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/embeddings",
                    json={
                        "model": settings.EMBEDDING_MODEL,
                        "prompt": text,
                    },
                )
            )
        payload = response.json()
        embedding = payload.get("embedding", [])
        return [float(value) for value in embedding]


class ApiEmbeddingProvider:
    name = "api-embedding"

    async def embed(self, text: str) -> list[float]:
        if not settings.EMBEDDING_API_URL or not text.strip():
            return await HashEmbeddingProvider().embed(text)
        async with httpx.AsyncClient(timeout=45) as client:
            response = await _with_retry(
                lambda: client.post(
                    settings.EMBEDDING_API_URL,
                    json={"model": settings.EMBEDDING_MODEL, "input": text},
                )
            )
        payload = response.json()
        embedding = payload.get("embedding") or payload.get("data", [{}])[0].get("embedding", [])
        return [float(value) for value in embedding]


def get_stt_provider() -> STTProvider:
    if settings.STT_PROVIDER == "api":
        return ApiSTTProvider()
    if settings.STT_PROVIDER == "whisper_local":
        return WhisperLocalSTTProvider()
    return NoopSTTProvider()


def get_llm_provider() -> LLMProvider:
    if settings.LLM_PROVIDER == "openai":
        return OpenAILLMProvider()
    if settings.LLM_PROVIDER == "anthropic":
        return AnthropicLLMProvider()
    if settings.LLM_PROVIDER == "deepseek":
        return DeepSeekLLMProvider()
    if settings.LLM_PROVIDER == "gemini":
        return GeminiLLMProvider()
    if settings.LLM_PROVIDER == "ollama":
        return OllamaLLMProvider()
    return DeterministicLLMProvider()


def get_embedding_provider() -> EmbeddingProvider:
    if settings.EMBEDDING_PROVIDER == "openai":
        return OpenAIEmbeddingProvider()
    if settings.EMBEDDING_PROVIDER == "gemini":
        return GeminiEmbeddingProvider()
    if settings.EMBEDDING_PROVIDER == "ollama":
        return OllamaEmbeddingProvider()
    if settings.EMBEDDING_PROVIDER == "api":
        return ApiEmbeddingProvider()
    return HashEmbeddingProvider()
