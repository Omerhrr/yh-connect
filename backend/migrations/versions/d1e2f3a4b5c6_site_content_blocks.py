"""add site_content_blocks table for header/footer/homepage CMS

Revision ID: d1e2f3a4b5c6
Revises: c3d4e5f6a7b8
Create Date: 2026-08-20 00:00:00.000000

Generic key -> JSON content block store so the header nav, footer, and
homepage sections (hero, how-it-works, why-choose, CTA banner) become
admin-editable, same "override falls back to hardcoded default" pattern
already used for ContentPage.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Guard against environments where the table was already created out of
    # band (e.g. via SQLAlchemy metadata.create_all on a fresh dev DB before
    # this migration existed) so upgrading doesn't crash with "table already
    # exists".
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'site_content_blocks' in inspector.get_table_names():
        return

    op.create_table(
        'site_content_blocks',
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('data', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('key'),
    )


def downgrade() -> None:
    op.drop_table('site_content_blocks')
