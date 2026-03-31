import re
from typing import Any, Dict, Tuple

from rest_framework.test import APIRequestFactory, force_authenticate

from apps.sales.views import SaleViewSet


SUPPORTED_EVENT_PATTERNS = {
    ("post", r"^/sales/$"): {"action": "create", "detail": False},
    ("post", r"^/sales/checkout-cash/$"): {"action": "checkout_cash", "detail": False},
    ("post", r"^/sales/initiate-payment/$"): {"action": "initiate_payment", "detail": False},
    ("post", r"^/sales/(?P<pk>\d+)/finalize-payment/$"): {"action": "finalize_payment", "detail": True},
    ("post", r"^/sales/(?P<pk>\d+)/void-transaction/$"): {"action": "void_transaction", "detail": True},
}


def parse_event_type(event_type: str) -> Tuple[str, str]:
    raw = str(event_type or "").strip()
    if not raw or ":" not in raw:
        return "", ""

    method, endpoint = raw.split(":", 1)
    method = method.strip().lower()
    endpoint = endpoint.strip() or "/"

    if not endpoint.startswith("/"):
        endpoint = f"/{endpoint}"

    endpoint = endpoint.split("?", 1)[0]
    return method, endpoint


def process_supported_event(*, user, tenant_id: str, outlet_id: str, event_type: str, payload: Any) -> Dict[str, Any]:
    method, endpoint = parse_event_type(event_type)
    if not method:
        return {"handled": False, "status": "unsupported", "detail": "Invalid event_type format."}

    matched = None
    match_kwargs: Dict[str, str] = {}
    for (candidate_method, pattern), meta in SUPPORTED_EVENT_PATTERNS.items():
        if candidate_method != method:
            continue
        m = re.match(pattern, endpoint)
        if m:
            matched = meta
            match_kwargs = m.groupdict()
            break

    if not matched:
        return {"handled": False, "status": "unsupported", "detail": "Event type is not mapped yet."}

    request_data = payload if isinstance(payload, dict) else {}
    if tenant_id and "tenant_id" not in request_data:
        request_data["tenant_id"] = tenant_id
    if outlet_id and "outlet" not in request_data and "outlet_id" not in request_data:
        request_data["outlet"] = outlet_id

    factory = APIRequestFactory()
    request = factory.post(
        f"/api/v1{endpoint}",
        request_data,
        format="json",
        HTTP_X_TENANT_ID=str(tenant_id or ""),
        HTTP_X_OUTLET_ID=str(outlet_id or ""),
    )
    force_authenticate(request, user=user)

    action = matched["action"]
    if matched.get("detail"):
        view = SaleViewSet.as_view({"post": action})
        response = view(request, pk=match_kwargs.get("pk"))
    else:
        view = SaleViewSet.as_view({"post": action})
        response = view(request)

    status_code = int(getattr(response, "status_code", 500))
    response_data = getattr(response, "data", None)

    if 200 <= status_code < 300:
        return {
            "handled": True,
            "status": "accepted",
            "detail": "Event processed via mapped sales action.",
            "status_code": status_code,
            "response": response_data,
        }

    return {
        "handled": True,
        "status": "rejected",
        "detail": "Mapped action rejected event payload.",
        "status_code": status_code,
        "response": response_data,
    }
