"""Small search service for the portfolio.

The portfolio page calls this function. The function calls SerpApi (which returns real
Google results and Google Images results) and sends back a simple, trimmed answer.
The SerpApi key stays here on the server and never reaches the browser.

Settings (Azure Function App > Environment variables):
  SERPAPI_KEY     your SerpApi key
  ALLOWED_ORIGIN  the address of your portfolio, for example https://paulmarvin.dev
                  (separate several with commas)
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

import azure.functions as func

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

SERPAPI_URL = "https://serpapi.com/search.json"
CACHE_SECONDS = 600
CACHE_LIMIT = 300
_cache = {}


def _text(value):
    return value.strip() if isinstance(value, str) else ""


def _allowed_origins():
    raw = os.environ.get("ALLOWED_ORIGIN", "")
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]


def _web_url(value):
    value = _text(value)
    return value if value.lower().startswith(("http://", "https://")) else ""


def normalize_web(data):
    results = []
    for item in data.get("organic_results") or []:
        link = _web_url(item.get("link"))
        if not link:
            continue
        results.append({
            "title": _text(item.get("title")),
            "link": link,
            "snippet": _text(item.get("snippet")),
            "site": _text(item.get("displayed_link")) or _text(item.get("source")),
        })

    answer = None
    box = data.get("answer_box")
    if isinstance(box, dict):
        text = _text(box.get("answer")) or _text(box.get("snippet")) or _text(box.get("result"))
        if text:
            answer = {"title": _text(box.get("title")), "text": text}

    knowledge = None
    graph = data.get("knowledge_graph")
    if isinstance(graph, dict) and _text(graph.get("title")):
        source = graph.get("source") if isinstance(graph.get("source"), dict) else {}
        image = _web_url(graph.get("thumbnail"))
        headers = graph.get("header_images")
        if not image and isinstance(headers, list) and headers and isinstance(headers[0], dict):
            image = _web_url(headers[0].get("image"))
        knowledge = {
            "title": _text(graph.get("title")),
            "subtitle": _text(graph.get("type")),
            "description": _text(graph.get("description")),
            "image": image,
            "link": _web_url(source.get("link")),
        }

    questions = []
    for item in data.get("related_questions") or []:
        if isinstance(item, dict) and _text(item.get("question")):
            questions.append({"question": _text(item.get("question")), "snippet": _text(item.get("snippet"))})

    related = []
    for item in data.get("related_searches") or []:
        if isinstance(item, dict) and _text(item.get("query")):
            related.append(_text(item.get("query")))

    pagination = data.get("serpapi_pagination") or {}
    return {
        "type": "web",
        "answer": answer,
        "knowledge": knowledge,
        "results": results,
        "questions": questions[:5],
        "related": related[:8],
        "next": isinstance(pagination, dict) and "next" in pagination,
    }


def normalize_images(data):
    images = []
    for item in data.get("images_results") or []:
        thumb = _web_url(item.get("thumbnail"))
        if not thumb:
            continue
        images.append({
            "title": _text(item.get("title")),
            "thumb": thumb,
            "full": _web_url(item.get("original")) or thumb,
            "site": _text(item.get("source")),
            "link": _web_url(item.get("link")),
        })
    return {"type": "images", "images": images, "next": len(images) > 0}


def _fetch(params):
    url = SERPAPI_URL + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": "portfolio-search/1.0"})
    with urllib.request.urlopen(request, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


def _reply(body, status, headers):
    return func.HttpResponse(json.dumps(body), status_code=status, mimetype="application/json", headers=headers)


@app.route(route="search", methods=["GET", "OPTIONS"])
def search(req: func.HttpRequest) -> func.HttpResponse:
    origin = (req.headers.get("Origin") or "").rstrip("/")
    allowed = _allowed_origins()
    headers = {"Vary": "Origin"}

    if origin:
        if origin not in allowed:
            return _reply({"error": "origin not allowed"}, 403, headers)
        headers["Access-Control-Allow-Origin"] = origin

    if req.method == "OPTIONS":
        headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        return func.HttpResponse(status_code=204, headers=headers)

    key = os.environ.get("SERPAPI_KEY", "")
    if not key:
        return _reply({"error": "search is not set up"}, 503, headers)

    query = (req.params.get("q") or "").strip()[:200]
    kind = req.params.get("type", "web")
    try:
        page = max(0, min(9, int(req.params.get("page", "0"))))
    except ValueError:
        page = 0

    if not query or kind not in ("web", "images"):
        return _reply({"error": "bad request"}, 400, headers)

    cache_key = (query.lower(), kind, page)
    hit = _cache.get(cache_key)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        headers["Cache-Control"] = "public, max-age=300"
        return _reply(hit[1], 200, headers)

    if kind == "web":
        params = {"engine": "google", "q": query, "hl": "en", "start": page * 10, "api_key": key}
    else:
        params = {"engine": "google_images", "q": query, "hl": "en", "ijn": page, "api_key": key}

    try:
        data = _fetch(params)
    except (urllib.error.URLError, TimeoutError, ValueError):
        return _reply({"error": "search service unavailable"}, 502, headers)

    if isinstance(data, dict) and data.get("error") and not (data.get("organic_results") or data.get("images_results")):
        return _reply({"error": "no results"}, 502, headers)

    body = normalize_web(data) if kind == "web" else normalize_images(data)

    if len(_cache) >= CACHE_LIMIT:
        _cache.clear()
    _cache[cache_key] = (time.time(), body)

    headers["Cache-Control"] = "public, max-age=300"
    return _reply(body, 200, headers)
