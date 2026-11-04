"""add entry extended fields and push subscriptions table

Revision ID: 0005_add_entry_extended_fields
Revises: 0004_add_user_is_verified
Create Date: 2026-11-04 16:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_add_entry_extended_fields"
down_revision: str | Sequence[str] | None = "0004_add_user_is_verified"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add extended fields to entries
    task_priority = sa.Enum("LOW", "MEDIUM", "HIGH", name="task_priority")
    task_priority.create(op.get_bind(), checkfirst=True)

    op.add_column("entries", sa.Column("title", sa.String(255), nullable=True))
    op.add_column("entries", sa.Column("task_priority", task_priority, nullable=True))
    op.add_column(
        "entries",
        sa.Column(
            "reminder_enabled",
            sa.Boolean(),
            nullable=True,
            server_default=sa.false(),
        ),
    )
    op.add_column("entries", sa.Column("reminder_time", sa.DateTime(), nullable=True))
    op.add_column("entries", sa.Column("reminder_end_time", sa.DateTime(), nullable=True))
    op.add_column("entries", sa.Column("reminder_recurrence", sa.String(50), nullable=True))
    op.add_column(
        "entries",
        sa.Column(
            "reminder_offset_minutes",
            sa.Integer(),
            nullable=True,
            server_default="0",
        ),
    )

    # 2. Create push_subscriptions table
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("p256dh", sa.Text(), nullable=False),
        sa.Column("auth", sa.Text(), nullable=False),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "endpoint", name="uq_push_user_endpoint"),
    )


def downgrade() -> None:
    op.drop_table("push_subscriptions")
    op.drop_column("entries", "reminder_offset_minutes")
    op.drop_column("entries", "reminder_recurrence")
    op.drop_column("entries", "reminder_end_time")
    op.drop_column("entries", "reminder_time")
    op.drop_column("entries", "reminder_enabled")
    op.drop_column("entries", "task_priority")
    op.drop_column("entries", "title")
