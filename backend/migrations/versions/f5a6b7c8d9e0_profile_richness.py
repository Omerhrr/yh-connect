"""profile richness: employment history, education, certifications, languages, project completed_at

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-08-07

"""
from alembic import op
import sqlalchemy as sa

revision = "f5a6b7c8d9e0"
down_revision = "e4f5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("professional_profiles", sa.Column("languages", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("completed_at", sa.DateTime(), nullable=True))

    op.create_table(
        "employment_history",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("profile_id", sa.String(), sa.ForeignKey("professional_profiles.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("employer", sa.String(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_employment_history_profile_id", "employment_history", ["profile_id"])

    op.create_table(
        "educations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("profile_id", sa.String(), sa.ForeignKey("professional_profiles.id"), nullable=False),
        sa.Column("school", sa.String(), nullable=False),
        sa.Column("degree", sa.String(), nullable=True),
        sa.Column("field_of_study", sa.String(), nullable=True),
        sa.Column("start_year", sa.Integer(), nullable=True),
        sa.Column("end_year", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_educations_profile_id", "educations", ["profile_id"])

    op.create_table(
        "certifications",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("profile_id", sa.String(), sa.ForeignKey("professional_profiles.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("issuing_body", sa.String(), nullable=True),
        sa.Column("issued_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("credential_url", sa.String(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_certifications_profile_id", "certifications", ["profile_id"])


def downgrade():
    op.drop_index("ix_certifications_profile_id", table_name="certifications")
    op.drop_table("certifications")
    op.drop_index("ix_educations_profile_id", table_name="educations")
    op.drop_table("educations")
    op.drop_index("ix_employment_history_profile_id", table_name="employment_history")
    op.drop_table("employment_history")
    op.drop_column("projects", "completed_at")
    op.drop_column("professional_profiles", "languages")
