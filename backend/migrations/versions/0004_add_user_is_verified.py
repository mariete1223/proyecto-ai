"""add is_verified column to users table

Revision ID: 0004_add_user_is_verified
Revises: 0003_allow_multiple_task_categories
Create Date: 2026-10-21 12:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_add_user_is_verified"
down_revision: str | Sequence[str] | None = "0003_allow_multiple_task_categories"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "is_verified")
