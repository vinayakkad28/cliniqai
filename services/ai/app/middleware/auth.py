from fastapi import Request, HTTPException, status
from app.config import settings


async def verify_internal_token(request: Request) -> None:
    """
    Validates X-Internal-Token header for service-to-service calls.
    This header is never exposed to clients — only the Core API sends it.
    """
    token = request.headers.get("X-Internal-Token")
    if not token or token != settings.internal_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal service token",
        )
