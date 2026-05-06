from __future__ import annotations


async def generate_openai_content(
    *,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    base_url: str | None = None,
) -> str:
    """Generate text using OpenAI's async Responses API.

    The import is intentionally lazy so the backend can still start in minimal
    environments before optional AI SDK dependencies are installed.
    """

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    response = await client.responses.create(
        model=model,
        instructions=system_prompt,
        input=user_prompt,
    )
    return str(response.output_text).strip()
