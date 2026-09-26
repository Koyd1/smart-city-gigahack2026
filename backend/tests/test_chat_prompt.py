from app.core.chat_prompt import detect_supported_language, model_unavailable_message, no_context_message


def test_supported_languages_are_detected() -> None:
    assert detect_supported_language("Какие документы нужны?") == "ru"
    assert detect_supported_language("Ce documente sunt necesare pentru primărie?") == "ro"
    assert detect_supported_language("Which documents are required?") == "en"


def test_no_context_and_failure_messages_follow_question_language() -> None:
    assert "муниципальной" in no_context_message("Какие документы нужны?")
    assert "Baza municipală" in no_context_message("Ce documente sunt necesare?")
    assert "municipal knowledge base" in no_context_message("Which documents are required?")
    assert "temporar indisponibil" in model_unavailable_message("Cum depun cererea?")
