from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.api_routes import router
from app.core.config import get_settings
from app.core.database import init_db

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB on startup
@app.on_event("startup")
def on_startup():
    init_db()

# Include Routes
# We mount the router at root to maintain compatibility with existing frontend calls (which expect /projects, etc.)
# Ideally, we'd use /api/v1/projects, but the frontend hardcodes these paths.
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8009, reload=False)
