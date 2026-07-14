import pytest
from fastapi import HTTPException

from app.modules.auth.service import normalize_phone


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("901234567", "+998901234567"),
        ("+998 90 123 45 67", "+998901234567"),
        ("998901234567", "+998901234567"),
    ],
)
def test_normalize_uzbek_phone(raw: str, expected: str) -> None:
    assert normalize_phone(raw) == expected


def test_normalize_phone_rejects_invalid_number() -> None:
    with pytest.raises(HTTPException):
        normalize_phone("123")
