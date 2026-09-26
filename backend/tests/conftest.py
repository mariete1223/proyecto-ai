from __future__ import annotations

from typing import Any, cast

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.schema import CheckConstraint


@compiles(CheckConstraint, "sqlite")
def ignore_postgres_regex_check_constraint_in_sqlite(
    element: CheckConstraint, compiler: Any, **kw: Any
) -> str:
    sql_text = str(element.sqltext)
    if "~" in sql_text:
        name = element.name or "ck_sqlite_dummy"
        return f"CONSTRAINT {name} CHECK (1=1)"
    return cast(str, compiler.visit_check_constraint(element, **kw))
