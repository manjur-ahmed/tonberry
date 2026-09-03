from pydantic import BaseModel


class LeadScoreRequest(BaseModel):
    phone: str | None = None
    property_type: str | None = None
    loan_amount: float | None = None
    message: str | None = None


def loan_size_score(loan_amount: float | None) -> float:
    if loan_amount is None:
        return 0
    if loan_amount < 100_000:
        return 20
    if loan_amount < 500_000:
        return 50
    if loan_amount < 1_000_000:
        return 75
    return 100


def completeness_score(request: LeadScoreRequest) -> float:
    optional_fields = [request.phone, request.property_type, request.message]
    filled = sum(1 for field in optional_fields if field) + (
        1 if request.loan_amount is not None else 0
    )
    return (filled / 4) * 100


def score_lead(request: LeadScoreRequest) -> float:
    """Deterministic rule-based baseline — bigger, more complete deals score
    higher. Replaced by a real model in Group 22 once there's enough data."""
    return round(
        loan_size_score(request.loan_amount) * 0.5
        + completeness_score(request) * 0.5,
        1,
    )
