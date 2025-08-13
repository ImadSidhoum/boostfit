from typing import List, Tuple
from decimal import Decimal  # add this

def ewma(points: List[Tuple[str, float]], alpha: float = 0.3):
    """
    points: list[(date_iso, weight_kg)]
    returns list[(date_iso, weight, trend)]
    """
    trend = None
    out = []
    alpha = Decimal(str(alpha))
    for d, w in points:
        w = Decimal(str(w))
        trend = w if trend is None else alpha * w + (1 - alpha) * trend
        out.append((d, w, round(trend, 2)))
    return out


def classify_energy(completion_ratio_7d: float) -> str:
    if completion_ratio_7d >= 0.8:
        return "high"
    if completion_ratio_7d >= 0.4:
        return "medium"
    return "low"
