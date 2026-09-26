from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.categories import router as categories_router
from app.api.v1.corrections import router as corrections_router
from app.api.v1.entries import router as entries_router
from app.api.v1.preferences import router as preferences_router
from app.api.v1.sync import router as sync_router
from app.api.v1.tags import router as tags_router
from app.api.v1.tasks import router as tasks_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth_router)
api_v1_router.include_router(categories_router)
api_v1_router.include_router(tags_router)
api_v1_router.include_router(entries_router)
api_v1_router.include_router(tasks_router)
api_v1_router.include_router(preferences_router)
api_v1_router.include_router(corrections_router)
api_v1_router.include_router(sync_router)
