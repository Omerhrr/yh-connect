"""dispute system rebuild (category, evidence, messages, audit trail, outcomes)

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The platform hasn't gone live with real payments yet (Monnify is still
    # in simulated mode), so there's no real dispute data to preserve.
    # Recreating the table fresh with the new shape avoids a fragile
    # cross-dialect enum-widening migration for what would be dev/test rows.
    op.drop_table('disputes')

    op.create_table(
        'disputes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('milestone_id', sa.String(), nullable=True),
        sa.Column('raised_by', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False, server_default='other'),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('evidence_urls', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='open'),
        sa.Column('outcome', sa.String(), nullable=True),
        sa.Column('resolution_note', sa.Text(), nullable=True),
        sa.Column('resolved_by', sa.String(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['milestone_id'], ['milestones.id']),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.ForeignKeyConstraint(['raised_by'], ['users.id']),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_disputes_project_id', 'disputes', ['project_id'])

    op.create_table(
        'dispute_messages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('dispute_id', sa.String(), nullable=False),
        sa.Column('sender_id', sa.String(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['dispute_id'], ['disputes.id']),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_dispute_messages_dispute_id', 'dispute_messages', ['dispute_id'])

    op.create_table(
        'dispute_events',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('dispute_id', sa.String(), nullable=False),
        sa.Column('actor_id', sa.String(), nullable=True),
        sa.Column('from_status', sa.String(), nullable=True),
        sa.Column('to_status', sa.String(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['dispute_id'], ['disputes.id']),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_dispute_events_dispute_id', 'dispute_events', ['dispute_id'])

    # Widen milestones.status / notifications.type to plain strings so future
    # value additions (like 'refunded' here, and the new dispute notification
    # types) don't require a table rebuild on every enum change.
    with op.batch_alter_table('milestones') as batch_op:
        batch_op.alter_column(
            'status', existing_type=sa.Enum(
                'pending', 'in_progress', 'submitted', 'approved', 'funded', 'paid',
                name='milestonestatus',
            ),
            type_=sa.String(), existing_nullable=False,
        )

    with op.batch_alter_table('notifications') as batch_op:
        batch_op.alter_column(
            'type', existing_type=sa.Enum(
                'bid_received', 'bid_accepted', 'bid_rejected', 'milestone_funded',
                'milestone_released', 'dispute_opened', 'invite_received',
                'message_received', 'kyc_status_changed', 'general',
                name='notificationtype',
            ),
            type_=sa.String(), existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table('notifications') as batch_op:
        batch_op.alter_column(
            'type', existing_type=sa.String(),
            type_=sa.Enum(
                'bid_received', 'bid_accepted', 'bid_rejected', 'milestone_funded',
                'milestone_released', 'dispute_opened', 'invite_received',
                'message_received', 'kyc_status_changed', 'general',
                name='notificationtype',
            ),
            existing_nullable=False,
        )
    with op.batch_alter_table('milestones') as batch_op:
        batch_op.alter_column(
            'status', existing_type=sa.String(),
            type_=sa.Enum(
                'pending', 'in_progress', 'submitted', 'approved', 'funded', 'paid',
                name='milestonestatus',
            ),
            existing_nullable=False,
        )

    op.drop_index('ix_dispute_events_dispute_id', table_name='dispute_events')
    op.drop_table('dispute_events')
    op.drop_index('ix_dispute_messages_dispute_id', table_name='dispute_messages')
    op.drop_table('dispute_messages')
    op.drop_index('ix_disputes_project_id', table_name='disputes')
    op.drop_table('disputes')

    op.create_table(
        'disputes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('milestone_id', sa.String(), nullable=True),
        sa.Column('raised_by', sa.String(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('status', sa.Enum('open', 'resolved', 'escalated', name='disputestatus'), nullable=False),
        sa.Column('resolution_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['milestone_id'], ['milestones.id']),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.ForeignKeyConstraint(['raised_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
