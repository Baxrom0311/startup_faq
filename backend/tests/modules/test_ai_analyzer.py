import asyncio

from app.core.config import settings
from app.modules.ai.analyzer import calculate_severity_score, cosine_similarity
from app.modules.ai.providers import (
    AnthropicLLMProvider,
    ApiSTTProvider,
    DeepSeekLLMProvider,
    DeterministicLLMProvider,
    GeminiEmbeddingProvider,
    GeminiLLMProvider,
    HashEmbeddingProvider,
    OpenAIEmbeddingProvider,
    OpenAILLMProvider,
    WhisperLocalSTTProvider,
    _extract_json_object,
    _validate_structured_data,
    get_embedding_provider,
    get_llm_provider,
    get_stt_provider,
)


def test_cosine_similarity_scores_matching_vectors() -> None:
    assert cosine_similarity([1, 0, 0], [1, 0, 0]) == 1
    assert cosine_similarity([1, 0, 0], [0, 1, 0]) == 0


def test_calculate_severity_score_uses_votes_pain_and_confidence() -> None:
    score = calculate_severity_score(
        vote_count=10,
        pain_level=4,
        confidence=0.8,
        duplicate_signal=True,
    )

    assert score == 81


def test_deterministic_llm_structures_text() -> None:
    structured = asyncio.run(
        DeterministicLLMProvider().structure_problem(
            "Issiqxonada suv bosimini kuzatish qiyin",
            has_audio=False,
        )
    )

    assert structured.is_actionable is True
    assert structured.title == "Issiqxonada suv bosimini kuzatish qiyin"
    assert "agro" in structured.tags
    assert structured.urgency == "medium"


def test_hash_embedding_provider_returns_stable_vector() -> None:
    provider = HashEmbeddingProvider()
    first = asyncio.run(provider.embed("suv bosimi"))
    second = asyncio.run(provider.embed("suv bosimi"))

    assert first == second
    assert len(first) == provider.dimensions


def test_get_embedding_provider_selects_configured_provider() -> None:
    original_provider = settings.EMBEDDING_PROVIDER
    try:
        settings.EMBEDDING_PROVIDER = "openai"
        assert isinstance(get_embedding_provider(), OpenAIEmbeddingProvider)

        settings.EMBEDDING_PROVIDER = "gemini"
        assert isinstance(get_embedding_provider(), GeminiEmbeddingProvider)

        settings.EMBEDDING_PROVIDER = "hash"
        assert isinstance(get_embedding_provider(), HashEmbeddingProvider)
    finally:
        settings.EMBEDDING_PROVIDER = original_provider


def test_openai_embedding_without_key_falls_back_to_hash() -> None:
    original_key = settings.OPENAI_API_KEY
    settings.OPENAI_API_KEY = ""
    try:
        embedding = asyncio.run(OpenAIEmbeddingProvider().embed("suv bosimi"))
    finally:
        settings.OPENAI_API_KEY = original_key

    assert len(embedding) == HashEmbeddingProvider.dimensions


def test_get_stt_provider_selects_configured_provider() -> None:
    original_provider = settings.STT_PROVIDER
    try:
        settings.STT_PROVIDER = "api"
        assert isinstance(get_stt_provider(), ApiSTTProvider)

        settings.STT_PROVIDER = "whisper_local"
        assert isinstance(get_stt_provider(), WhisperLocalSTTProvider)
    finally:
        settings.STT_PROVIDER = original_provider


def test_get_llm_provider_selects_configured_provider() -> None:
    original_provider = settings.LLM_PROVIDER
    try:
        settings.LLM_PROVIDER = "openai"
        assert isinstance(get_llm_provider(), OpenAILLMProvider)

        settings.LLM_PROVIDER = "anthropic"
        assert isinstance(get_llm_provider(), AnthropicLLMProvider)

        settings.LLM_PROVIDER = "deepseek"
        assert isinstance(get_llm_provider(), DeepSeekLLMProvider)

        settings.LLM_PROVIDER = "gemini"
        assert isinstance(get_llm_provider(), GeminiLLMProvider)
    finally:
        settings.LLM_PROVIDER = original_provider


def test_openai_provider_without_key_falls_back_to_deterministic() -> None:
    original_provider = settings.OPENAI_API_KEY
    settings.OPENAI_API_KEY = ""
    try:
        structured = asyncio.run(
            OpenAILLMProvider().structure_problem("Suv bosimi past", has_audio=False)
        )
    finally:
        settings.OPENAI_API_KEY = original_provider

    assert structured.title == "Suv bosimi past"
    assert structured.is_actionable is True


def test_deepseek_provider_without_key_falls_back_to_deterministic() -> None:
    original_key = settings.DEEPSEEK_API_KEY
    settings.DEEPSEEK_API_KEY = ""
    try:
        structured = asyncio.run(
            DeepSeekLLMProvider().structure_problem("Logistika kechikyapti", has_audio=False)
        )
    finally:
        settings.DEEPSEEK_API_KEY = original_key

    assert structured.title == "Logistika kechikyapti"
    assert structured.is_actionable is True


def test_gemini_provider_without_key_falls_back_to_deterministic() -> None:
    original_key = settings.GEMINI_API_KEY
    settings.GEMINI_API_KEY = ""
    try:
        structured = asyncio.run(
            GeminiLLMProvider().structure_problem("Dorixona topish qiyin", has_audio=False)
        )
    finally:
        settings.GEMINI_API_KEY = original_key

    assert structured.title == "Dorixona topish qiyin"
    assert structured.is_actionable is True


def test_extract_json_object_handles_markdown_fence() -> None:
    data = _extract_json_object('```json\n{"title":"A","summary":"B"}\n```')

    assert data == {"title": "A", "summary": "B"}


def test_validate_structured_data_normalizes_fields() -> None:
    structured = _validate_structured_data(
        {
            "title": "  Suv muammosi  ",
            "summary": "Suv bosimi past",
            "pain_level": 10,
            "confidence": 5,
            "tags": [" Agro ", "agro", "Suv bosimi"],
            "flags": {"spam": True},
        },
        "Suv bosimi past",
        has_audio=False,
    )

    assert structured.pain_level == 5
    assert structured.confidence == 1
    assert structured.tags == ["agro", "suv-bosimi"]
    assert structured.flags["needs_review"] is True
    assert structured.moderation_reason == "AI review required"
