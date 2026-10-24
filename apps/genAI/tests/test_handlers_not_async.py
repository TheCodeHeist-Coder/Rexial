import inspect

from app import main


def test_blocking_handlers_are_plain_def():
    # These call blocking provider/PDF code and never await. As `async def` they
    # run on the event loop and freeze /health; as plain `def` FastAPI runs them
    # in its threadpool.
    for handler in (
        main.generate_pdf_questions,
        main.ask_pdf_question,
        main.generate_quiz_endpoint,
        main.chat_endpoint,
    ):
        assert not inspect.iscoroutinefunction(handler), handler.__name__
