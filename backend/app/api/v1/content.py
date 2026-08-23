import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models.category import Category
from app.models.content import BlogPost, ContentPage, FaqItem, HomepageHighlight, SiteContentBlock
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
    FaqItemCreate,
    FaqItemOut,
    FaqItemPatch,
    HighlightCreate,
    HighlightOut,
    HighlightPatch,
    SiteContentBlockOut,
    SiteContentBlockUpsert,
)
from app.schemas.category import CategoryOut

router = APIRouter(tags=["content"])


# ─── Site content blocks (header/footer/homepage CMS) ──────────────────────
@router.get("/site-content")
def get_site_content(db: Session = Depends(get_db)):
    """Public: every customized content block, as {key: data}. Sections with
    no row here simply weren't customized yet, the frontend falls back to
    its hardcoded defaults for anything missing (see src/lib/siteContent.ts),
    so a partially-filled-in CMS never breaks the site."""
    blocks = db.query(SiteContentBlock).all()
    out = {}
    for b in blocks:
        try:
            out[b.key] = json.loads(b.data)
        except (TypeError, ValueError):
            continue
    return out


@router.get("/admin/site-content", response_model=list[SiteContentBlockOut])
def admin_list_site_content(current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    blocks = db.query(SiteContentBlock).all()
    return [
        SiteContentBlockOut(key=b.key, data=json.loads(b.data) if b.data else {}, updated_at=b.updated_at)
        for b in blocks
    ]


@router.put("/admin/site-content/{key}", response_model=SiteContentBlockOut)
def admin_upsert_site_content(
    key: str,
    payload: SiteContentBlockUpsert,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    block = db.get(SiteContentBlock, key)
    data_json = json.dumps(payload.data)
    if block:
        block.data = data_json
        block.updated_by = current_user.id
        block.updated_at = datetime.utcnow()
    else:
        block = SiteContentBlock(key=key, data=data_json, updated_by=current_user.id)
        db.add(block)
    db.commit()
    db.refresh(block)
    return SiteContentBlockOut(key=block.key, data=json.loads(block.data), updated_at=block.updated_at)


@router.delete("/admin/site-content/{key}", status_code=204)
def admin_reset_site_content(
    key: str, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)
):
    """Reset a section back to the hardcoded default by deleting its override."""
    block = db.get(SiteContentBlock, key)
    if block:
        db.delete(block)
        db.commit()


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


@router.get("/content/faq", response_model=list[FaqItemOut])
def list_active_faq(db: Session = Depends(get_db)):
    return (
        db.query(FaqItem)
        .filter(FaqItem.active.is_(True))
        .order_by(FaqItem.category, FaqItem.sort_order)
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


# ─── Admin: FAQ ───────────────────────────────────────────────────────────
@router.get("/admin/content/faq", response_model=list[FaqItemOut])
def admin_list_faq(current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    return db.query(FaqItem).order_by(FaqItem.category, FaqItem.sort_order).all()


@router.post("/admin/content/faq", response_model=FaqItemOut, status_code=201)
def admin_create_faq(
    payload: FaqItemCreate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    item = FaqItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/admin/content/faq/{item_id}", response_model=FaqItemOut)
def admin_patch_faq(
    item_id: str,
    payload: FaqItemPatch,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    item = db.get(FaqItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="FAQ item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


@router.delete("/admin/content/faq/{item_id}", status_code=204)
def admin_delete_faq(
    item_id: str, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)
):
    item = db.get(FaqItem, item_id)
    if item:
        db.delete(item)
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
