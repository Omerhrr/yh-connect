"""project reports: talent flagging a job listing as inappropriate

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-08-07

"""
from alembic import op
import sqlalchemy as sa

revision = "a6b7c8d9e0f1"
down_revision = "f5a6b7c8d9e0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "project_reports",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("reporter_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_project_reports_project_id", "project_reports", ["project_id"])
    op.create_index("ix_project_reports_reporter_id", "project_reports", ["reporter_id"])


def downgrade():
    op.drop_index("ix_project_reports_reporter_id", table_name="project_reports")
    op.drop_index("ix_project_reports_project_id", table_name="project_reports")
    op.drop_table("project_reports")
