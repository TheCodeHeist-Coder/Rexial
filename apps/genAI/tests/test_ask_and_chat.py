from tests.conftest import SAMPLE_PDF, make_pdf


def ask(client, query, pdf=SAMPLE_PDF):
    return client.post(
        "/ask-pdf",
        files={"file": ("notes.pdf", pdf, "application/pdf")},
        data={"user_query": query},
    )


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_ask_pdf_answers_from_retrieved_context(client, groq, fake_embeddings, upload_dir):
    groq.reply("Light energy becomes chemical energy.")

    res = ask(client, "What does photosynthesis do?")

    assert res.status_code == 200
    body = res.json()
    assert body["answer"] == "Light energy becomes chemical energy."
    assert body["question"] == "What does photosynthesis do?"
    assert "Photosynthesis converts light energy" in groq.prompts[0]
    assert list(upload_dir.iterdir()) == []


def test_ask_pdf_without_text_is_422(client, groq, fake_embeddings):
    assert ask(client, "anything", pdf=make_pdf()).status_code == 422


def test_chat_answers_directly_when_no_search_needed(client, gemini):
    gemini.reply("NO_SEARCH", "Hello there!")

    res = client.post("/chat", json={"user_query": "hi"})

    assert res.json() == {"response": "Hello there!"}
    assert len(gemini.prompts) == 2


def test_chat_uses_web_search_when_router_says_so(client, gemini, monkeypatch):
    from app.agent import Qnagent

    class FakeSearch:
        def invoke(self, args):
            return f"results for {args['query']}"

    monkeypatch.setattr(Qnagent, "get_search", FakeSearch)
    gemini.reply("SEARCH", "It is sunny.")

    res = client.post("/chat", json={"user_query": "weather today"})

    assert res.json() == {"response": "It is sunny."}
    assert "results for weather today" in gemini.prompts[1][0].content


def test_chat_flattens_gemini_content_parts(client, gemini):
    gemini.reply(
        [{"type": "text", "text": "NO_"}, "SEARCH"],
        [{"type": "text", "text": "Hello, "}, {"type": "text", "text": "world"}],
    )

    res = client.post("/chat", json={"user_query": "hi"})

    assert res.json() == {"response": "Hello, world"}
