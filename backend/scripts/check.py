from __future__ import annotations

import subprocess
import sys

CHECKS = (
    (sys.executable, "-m", "ruff", "format", "--check", "app", "scripts", "tests"),
    (sys.executable, "-m", "ruff", "check", "app", "scripts", "tests"),
    (sys.executable, "-m", "mypy", "app", "scripts", "tests"),
    (sys.executable, "-m", "pytest"),
)


def main() -> int:
    for command in CHECKS:
        result = subprocess.run(command, check=False)
        if result.returncode != 0:
            return result.returncode

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
