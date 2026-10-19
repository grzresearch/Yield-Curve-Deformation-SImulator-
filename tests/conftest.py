import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from yield_curve import YieldCurve  # noqa: E402

README_TENORS = np.array([0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30])
README_RATES = np.array([5.25, 5.20, 5.00, 4.50, 4.25, 4.00, 4.10, 4.25, 4.50, 4.60])


@pytest.fixture
def readme_curve():
    return YieldCurve(README_TENORS, README_RATES)
