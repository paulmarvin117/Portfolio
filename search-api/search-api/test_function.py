import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
os.environ["SERPAPI_KEY"] = "test-key"
os.environ["ALLOWED_ORIGIN"] = "https://paul.example"
import azure.functions as func
import function_app as fa

calls = []
WEB = {
  "organic_results": [
    {"title": "Python Decorators", "link": "https://realpython.com/x", "snippet": "A decorator wraps a function.", "displayed_link": "realpython.com › decorators"},
    {"title": "bad link", "link": "javascript:alert(1)", "snippet": "x"},
  ],
  "answer_box": {"snippet": "Decorators wrap functions.", "title": "Answer"},
  "knowledge_graph": {"title": "Python", "type": "Programming language", "description": "High-level language.", "header_images": [{"image": "https://img.example/p.png"}], "source": {"link": "https://en.wikipedia.org/wiki/Python"}},
  "related_questions": [{"question": "What is a decorator?", "snippet": "It wraps."}],
  "related_searches": [{"query": "python decorators tutorial"}],
  "serpapi_pagination": {"next": "https://serpapi.com/..."},
}
IMG = {"images_results": [
  {"title": "A cat", "thumbnail": "https://t.example/1.jpg", "original": "https://o.example/1.jpg", "source": "Example", "link": "https://example.com/cat"},
  {"title": "no thumb"},
]}

def fake_fetch(params):
    calls.append(params)
    return WEB if params["engine"] == "google" else IMG
fa._fetch = fake_fetch

def call(qs, origin="https://paul.example", method="GET"):
    h = {"Origin": origin} if origin else {}
    req = func.HttpRequest(method=method, url="/api/search", headers=h, params=qs, body=b"")
    r = fa.search.build().get_user_function()(req)
    return r

r = call({"q": "python decorators", "type": "web"})
b = json.loads(r.get_body()); assert r.status_code == 200
assert len(b["results"]) == 1 and b["results"][0]["site"].startswith("realpython")
assert b["answer"]["text"] == "Decorators wrap functions."
assert b["knowledge"]["image"] == "https://img.example/p.png" and b["knowledge"]["link"].endswith("/Python")
assert b["related"] == ["python decorators tutorial"] and b["next"] is True
assert r.headers["Access-Control-Allow-Origin"] == "https://paul.example"
print("web ok")

r = call({"q": "cats", "type": "images", "page": "2"})
b = json.loads(r.get_body()); assert len(b["images"]) == 1 and b["images"][0]["full"].startswith("https://o.example")
assert calls[-1]["engine"] == "google_images" and calls[-1]["ijn"] == 2
print("images ok")

n = len(calls); call({"q": "python decorators", "type": "web"}); assert len(calls) == n; print("cache ok")
assert call({"q": "x"}, origin="https://evil.example").status_code == 403; print("origin block ok")
assert call({"q": ""}).status_code == 400 and call({"q": "x", "type": "video"}).status_code == 400; print("validation ok")
r = call({}, method="OPTIONS"); assert r.status_code == 204; print("preflight ok")
fa._fetch = lambda p: (_ for _ in ()).throw(TimeoutError())
assert call({"q": "new query"}).status_code == 502; print("upstream failure ok")
os.environ["SERPAPI_KEY"] = ""; assert call({"q": "z"}).status_code == 503; print("missing key ok")
