"""message replies, reactions, and message types (voice/image/file)

Revision ID: d4e5f6a7b8c9
Revises: c8d9e0f1a2b3
Create Date: 2026-08-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c8d9e0f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('messages', sa.Column('message_type', sa.String(), nullable=False, server_default='text'))
    op.add_column('messages', sa.Column('duration_seconds', sa.Integer(), nullable=True))
    # A *self-referential* FK column needs batch mode on SQLite specifically,
    # SQLite can't ALTER TABLE ADD CONSTRAINT at all, and unlike a column-level
    # FK to a different (already-existing) table, alembic emits this one as a
    # separate ADD CONSTRAINT when the FK target is the same table, which
    # fails outside batch mode. Batch mode works fine on Postgres too, it
    # just does a plain ALTER there instead of the copy-and-move dance.
    with op.batch_alter_table('messages') as batch_op:
        batch_op.add_column(sa.Column('reply_to_id', sa.String(), nullable=True))
        batch_op.create_foreign_key('fk_messages_reply_to_id', 'messages', ['reply_to_id'], ['id'])

    op.create_table(
        'message_reactions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('message_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('emoji', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('message_id', 'user_id', name='uq_reaction_message_user'),
    )
    op.create_index('ix_message_reactions_message_id', 'message_reactions', ['message_id'])


def downgrade() -> None:
    op.drop_index('ix_message_reactions_message_id', table_name='message_reactions')
    op.drop_table('message_reactions')
    with op.batch_alter_table('messages') as batch_op:
        batch_op.drop_constraint('fk_messages_reply_to_id', type_='foreignkey')
        batch_op.drop_column('reply_to_id')
    op.drop_column('messages', 'duration_seconds')
    op.drop_column('messages', 'message_type')
