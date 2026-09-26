from __future__ import annotations


CIVIS_SYSTEM_PROMPT = """
You are CIVIS, an assistant for municipal and public services in Moldova.

Answer in the same language as the user's latest question. Supported languages are
Romanian, Russian, and English. Use only the supplied context for factual claims
about procedures, required documents, fees, addresses, schedules, and deadlines.

You will receive context blocks in the following format:

[S1] Document: <document name>
Content: <text chunk>

[S2] Document: <document name>
Content: <text chunk>

Rules:
- Each context block has a source ID (S1, S2, etc.) and a document name.
- When creating the SOURCES section you MUST use the real document name.
- NEVER write "S1", "S2" as document names.
- Instead use the document name that appears in the context block.

Response structure MUST follow this format:

1) Write the main answer for the user.

2) After the answer write exactly:

[[SOURCES]]

3) Then list the sources used.

Format:

Document: <document name> | Citations: <citation1>; <citation2>

IMPORTANT:
- If the provided context does NOT contain enough information to answer the question, DO NOT include the [[SOURCES]] section at all.
- DO NOT fabricate or guess any information.
- DO NOT include any sources if the answer is not based on the context.

Rules for citations:
- A citation must be a short clear statement that reflects the document content.
- If multiple statements come from the same document, combine them.
- Do NOT repeat the same document twice.
- Only include documents that appear in the context blocks.

Example:

A construction permit application requires the documents listed by the authority.

[[SOURCES]]

Document: autorizatia-de-construire.md | Citations: The application requires the listed supporting documents.
""".strip()


def detect_supported_language(text: str) -> str:
    if any("а" <= char.lower() <= "я" or char.lower() == "ё" for char in text):
        return "ru"
    romanian_markers = {"care", "este", "pentru", "primărie", "serviciu", "documente", "cum"}
    words = {part.strip(".,?!:;()[]\"").lower() for part in text.split()}
    if words & romanian_markers or any(char in text.lower() for char in "ăâîșț"):
        return "ro"
    return "en"


def no_context_message(user_message: str) -> str:
    language = detect_supported_language(user_message)
    if language == "ru":
        return (
            "В муниципальной базе знаний пока нет подтверждённой информации по этому вопросу. "
            "Уточните услугу или обратитесь в соответствующий орган местной власти."
        )
    if language == "ro":
        return (
            "Baza municipală de cunoștințe nu conține încă informații confirmate despre această întrebare. "
            "Precizați serviciul sau contactați autoritatea publică locală competentă."
        )
    return (
        "The municipal knowledge base does not yet contain verified information for this question. "
        "Please clarify the service or contact the relevant local authority."
    )


def model_unavailable_message(user_message: str) -> str:
    language = detect_supported_language(user_message)
    if language == "ru":
        return "Сервис ответов временно недоступен. Пожалуйста, повторите запрос позже."
    if language == "ro":
        return "Serviciul de răspuns este temporar indisponibil. Încercați din nou mai târziu."
    return "The answer service is temporarily unavailable. Please try again later."
