from app.core.source_parser import resolve_source_name


def test_resolve_source_name_matches_title_without_numeric_prefix() -> None:
    candidates = [
        "17 Certificat de urbanism pentru proiectare",
        "18 Certificat de urbanism informativ",
    ]

    assert (
        resolve_source_name("Certificat de urbanism pentru proiectare", candidates)
        == candidates[0]
    )


def test_resolve_source_name_rejects_unrelated_title() -> None:
    assert resolve_source_name("Autorizație sanitară", ["Certificat de urbanism"]) is None
