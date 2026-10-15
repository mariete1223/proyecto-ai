"""add tag color column

Revision ID: 0002_add_tag_color
Revises: 0001_initial
Create Date: 2026-10-11 15:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_add_tag_color"
down_revision: str | Sequence[str] | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tags",
        sa.Column(
            "color",
            sa.String(length=7),
            nullable=False,
            server_default="#64748B",
        ),
    )


def downgrade() -> None:
    op.drop_column("tags", "color")
