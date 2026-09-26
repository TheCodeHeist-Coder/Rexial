import json

from app import main
from tests.conftest import SAMPLE_PDF, make_pdf, question, quiz_reply


def post_quiz(client, pdf=SAMPLE_PDF, content_type="application/pdf", **fields):
    return client.post(
        "/generate-quiz",
        files={"file": ("notes.pdf", pdf, content_type)},
        data=fields,
    )


def test_returns_valid_questions_and_honours_count(client, groq):
    groq.reply(quiz_reply(question("Q1"), question("Q2"), question("Q3")))

    res = post_quiz(client, count="2")

    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 2
    assert [q["text"] for q in body["questions"]] == ["Q1", "Q2"]


def test_prompt_carries_settings_and_pdf_text(client, groq):
    groq.reply(quiz_reply(question("Q1", "High")))

    post_quiz(client, count="7", difficulty="High", user_query="chapter 2")

    prompt = groq.prompts[0]
    assert "Generate exactly 7 questions." in prompt
    assert 'Every question must have "difficulty": "High".' in prompt
    assert "chapter 2" in prompt
    assert "Photosynthesis converts light energy" in prompt


def test_mixed_difficulty_and_empty_focus(client, groq):
    groq.reply(quiz_reply(question("Q1")))

    post_quiz(client, difficulty="Mixed")

    prompt = groq.prompts[0]
    assert "Mix Low, Medium and High difficulty." in prompt
    assert "Cover the most important concepts." in prompt
    assert "Do NOT repeat" not in prompt


def test_exclude_lists_existing_questions(client, groq):
    groq.reply(quiz_reply(question("Fresh question")))

    res = post_quiz(
        client,
        count="1",
        exclude=json.dumps(["What is photosynthesis?", "What are mitochondria?"]),
    )

    assert res.status_code == 200
    prompt = groq.prompts[0]
    assert "Do NOT repeat or rephrase" in prompt
    assert "- What is photosynthesis?" in prompt
    assert "- What are mitochondria?" in prompt


def test_malformed_questions_are_dropped(client, groq):
    two_correct = question("Two correct")
    two_correct["options"][1]["isCorrect"] = True
    three_options = question("Three options")
    three_options["options"].pop()
    bad_difficulty = question("Odd difficulty", difficulty="extreme")

    groq.reply(quiz_reply(two_correct, three_options, bad_difficulty))

    body = post_quiz(client).json()

    assert [q["text"] for q in body["questions"]] == ["Odd difficulty"]
    assert body["questions"][0]["difficulty"] == "Medium"


def test_json_wrapped_in_markdown_fence_is_accepted(client, groq):
    groq.reply("```json\n" + quiz_reply(question("Fenced")) + "\n```")

    assert post_quiz(client).json()["questions"][0]["text"] == "Fenced"


def test_unusable_model_output_is_502(client, groq):
    groq.reply("Sorry, I cannot help with that.")

    res = post_quiz(client)

    assert res.status_code == 502
    assert "unusable response" in res.json()["detail"]


def test_no_valid_questions_is_422(client, groq):
    groq.reply(quiz_reply())

    assert post_quiz(client).status_code == 422


def test_count_out_of_range_is_rejected(client, groq):
    assert post_quiz(client, count="0").status_code == 422
    assert post_quiz(client, count="21").status_code == 422
    assert groq.prompts == []


def test_bad_exclude_is_400(client, groq):
    assert post_quiz(client, exclude="not json").status_code == 400
    assert post_quiz(client, exclude=json.dumps([1, 2])).status_code == 400
    assert groq.prompts == []


def test_non_pdf_is_rejected(client, groq):
    res = post_quiz(client, pdf=b"hello", content_type="text/plain")

    assert res.status_code == 400
    assert groq.prompts == []


def test_oversized_pdf_is_413(client, groq, monkeypatch, upload_dir):
    monkeypatch.setattr(main, "MAX_UPLOAD_BYTES", 100)

    res = post_quiz(client)

    assert res.status_code == 413
    assert "too large" in res.json()["detail"]
    assert list(upload_dir.iterdir()) == []


def test_pdf_without_text_is_422(client, groq):
    res = post_quiz(client, pdf=make_pdf())

    assert res.status_code == 422
    assert "no selectable text" in res.json()["detail"]
    assert groq.prompts == []


def test_upload_is_deleted_after_success_and_failure(client, groq, upload_dir):
    groq.reply(quiz_reply(question("Q1")), RuntimeError("provider down"))

    assert post_quiz(client).status_code == 200
    assert post_quiz(client).status_code == 502
    assert list(upload_dir.iterdir()) == []


def test_rate_limit_maps_to_429(client, groq):
    class RateLimitError(Exception):
        pass

    groq.reply(RateLimitError("slow down"))

    assert post_quiz(client).status_code == 429
