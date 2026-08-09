from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models.category import Category
from app.models.content import BlogPost, ContentPage, HomepageHighlight
from app.models.user import User, UserRole
from app.schemas.content import (
    BlogPostCreate,
    BlogPostOut,
    BlogPostPatch,
    CategoryCreate,
    CategoryPatch,
    ContentPageOut,
    ContentPagePatch,
    ContentPageUpsert,
    HighlightCreate,
    HighlightOut,
    HighlightPatch,
)
from app.schemas.category import CategoryOut

router = APIRouter(tags=["content"])


# ─── Public reads ────────────────────────────────────────────────────────
@router.get("/content/pages/{slug}", response_model=ContentPageOut)
def get_content_page(slug: str, db: Session = Depends(get_db)):
    page = db.query(ContentPage).filter(ContentPage.slug == slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@router.get("/content/blog", response_model=list[BlogPostOut])
def list_published_blog_posts(db: Session = Depends(get_db)):
    return (
        db.query(BlogPost)
        .filter(BlogPost.published.is_(True))
        .order_by(BlogPost.published_at.desc().nullslast())
        .all()
    )


@router.get("/content/blog/{slug}", response_model=BlogPostOut)
def get_blog_post(slug: str, db: Session = Depends(get_db)):
    post = db.query(BlogPost).filter(BlogPost.slug == slug, BlogPost.published.is_(True)).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.get("/content/highlights", response_model=list[HighlightOut])
def list_active_highlights(db: Session = Depends(get_db)):
    return (
        db.query(HomepageHighlight)
        .filter(HomepageHighlight.active.is_(True))
        .order_by(HomepageHighlight.sort_order)
        .all()
    )


# ─── Admin: content pages ───────────────────────────────────────────────
@router.get("/admin/content/pages", response_model=list[ContentPageOut])
def admin_list_pages(current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    return db.query(ContentPage).order_by(ContentPage.slug).all()


@router.post("/admin/content/pages", response_model=ContentPageOut, status_code=201)
def admin_upsert_page(
    payload: ContentPageUpsert,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    page = db.query(ContentPage).filter(ContentPage.slug == payload.slug).first()
    if page:
        page.title = payload.title
        page.body = payload.body
    else:
        page = ContentPage(slug=payload.slug, title=payload.title, body=payload.body)
        db.add(page)
    page.updated_by = current_user.id
    page.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(page)
    return page


@router.patch("/admin/content/pages/{page_id}", response_model=ContentPageOut)
def admin_patch_page(
    page_id: str,
    payload: ContentPagePatch,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    page = db.get(ContentPage, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    if payload.title is not None:
        page.title = payload.title
    if payload.body is not None:
        page.body = payload.body
    page.updated_by = current_user.id
    page.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(page)
    return page


@router.delete("/admin/content/pages/{page_id}", status_code=204)
def admin_delete_page(
    page_id: str, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)
):
    page = db.get(ContentPage, page_id)
    if page:
        db.delete(page)
        db.commit()


# ─── Admin: blog posts ───────────────────────────────────────────────────
@router.get("/admin/content/blog", response_model=list[BlogPostOut])
def admin_list_blog_posts(current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    return db.query(BlogPost).order_by(BlogPost.created_at.desc()).all()


@router.post("/admin/content/blog", response_model=BlogPostOut, status_code=201)
def admin_create_blog_post(
    payload: BlogPostCreate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    if db.query(BlogPost).filter(BlogPost.slug == payload.slug).first():
        raise HTTPException(status_code=409, detail="A post with this slug already exists")
    post = BlogPost(
        **payload.model_dump(),
        published_at=datetime.utcnow() if payload.published else None,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.patch("/admin/content/blog/{post_id}", response_model=BlogPostOut)
def admin_patch_blog_post(
    post_id: str,
    payload: BlogPostPatch,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    post = db.get(BlogPost, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    data = payload.model_dump(exclude_unset=True)
    was_published = post.published
    for field, value in data.items():
        setattr(post, field, value)
    if post.published and not was_published:
        post.published_at = datetime.utcnow()
    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)
    return post


@router.delete("/admin/content/blog/{post_id}", status_code=204)
def admin_delete_blog_post(
    post_id: str, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)
):
    post = db.get(BlogPost, post_id)
    if post:
        db.delete(post)
        db.commit()


# ─── Admin: homepage highlights ──────────────────────────────────────────
@router.get("/admin/content/highlights", response_model=list[HighlightOut])
def admin_list_highlights(current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    return db.query(HomepageHighlight).order_by(HomepageHighlight.sort_order).all()


@router.post("/admin/content/highlights", response_model=HighlightOut, status_code=201)
def admin_create_highlight(
    payload: HighlightCreate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    highlight = HomepageHighlight(**payload.model_dump())
    db.add(highlight)
    db.commit()
    db.refresh(highlight)
    return highlight


@router.patch("/admin/content/highlights/{highlight_id}", response_model=HighlightOut)
def admin_patch_highlight(
    highlight_id: str,
    payload: HighlightPatch,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    highlight = db.get(HomepageHighlight, highlight_id)
    if not highlight:
        raise HTTPException(status_code=404, detail="Highlight not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(highlight, field, value)
    db.commit()
    db.refresh(highlight)
    return highlight


@router.delete("/admin/content/highlights/{highlight_id}", status_code=204)
def admin_delete_highlight(
    highlight_id: str, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)
):
    highlight = db.get(HomepageHighlight, highlight_id)
    if highlight:
        db.delete(highlight)
        db.commit()


# ─── Admin: categories ────────────────────────────────────────────────────
@router.post("/admin/categories", response_model=CategoryOut, status_code=201)
def admin_create_category(
    payload: CategoryCreate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    if db.get(Category, payload.id):
        raise HTTPException(status_code=409, detail="A category with this id already exists")
    category = Category(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/admin/categories/{category_id}", response_model=CategoryOut)
def admin_patch_category(
    category_id: str,
    payload: CategoryPatch,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/admin/categories/{category_id}", status_code=204)
def admin_delete_category(
    category_id: str, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)
):
    category = db.get(Category, category_id)
    if category:
        db.delete(category)
        db.commit()
