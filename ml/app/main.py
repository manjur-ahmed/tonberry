from datetime import datetime, timezone

from fastapi import FastAPI

from app.scoring import LeadScoreRequest, score_lead

app = FastAPI(title="tonberry-ml")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.post("/score")
def score(request: LeadScoreRequest) -> dict:
    return {"priority_score": score_lead(request)}
