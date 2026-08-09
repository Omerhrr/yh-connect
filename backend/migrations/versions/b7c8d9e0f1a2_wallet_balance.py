"""prepaid client wallet balance

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f1
Create Date: 2026-08-09

"""
from alembic import op
import sqlalchemy as sa

revision = "b7c8d9e0f1a2"
down_revision = "a6b7c8d9e0f1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("wallet_balance", sa.Float(), nullable=False, server_default="0"))

    with op.batch_alter_table("wallet_transactions") as batch_op:
        batch_op.alter_column("project_id", existing_type=sa.String(), nullable=True)


def downgrade():
    with op.batch_alter_table("wallet_transactions") as batch_op:
        batch_op.alter_column("project_id", existing_type=sa.String(), nullable=False)

    op.drop_column("users", "wallet_balance")
