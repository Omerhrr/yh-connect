from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    bids,
    categories,
    clients,
    content,
    disputes,
    favorites,
    internal,
    invites,
    messages,
    milestones,
    notifications,
    portfolio,
    professionals,
    profile_sections,
    project_access_requests,
    projects,
    reviews,
    uploads,
    verification,
    wallet,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(content.router)
api_router.include_router(categories.router)
api_router.include_router(professionals.router)
api_router.include_router(portfolio.router)
api_router.include_router(profile_sections.router)
api_router.include_router(verification.router)
api_router.include_router(projects.router)
api_router.include_router(bids.router)
api_router.include_router(invites.router)
api_router.include_router(project_access_requests.router)
api_router.include_router(milestones.router)
api_router.include_router(wallet.router)
api_router.include_router(disputes.router)
api_router.include_router(messages.router)
api_router.include_router(messages.legacy_router)
api_router.include_router(reviews.router)
api_router.include_router(clients.router)
api_router.include_router(uploads.router)
api_router.include_router(notifications.router)
api_router.include_router(favorites.router)
api_router.include_router(internal.router)
