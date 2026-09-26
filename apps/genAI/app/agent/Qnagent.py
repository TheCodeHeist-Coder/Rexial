from langchain_core.messages import HumanMessage
from langchain_tavily import TavilySearch

from app.utils.config import TAVILY_API_KEY, require
from app.utils.llm import get_google_llm

_search = None


def get_search():
    """Build the Tavily client on first use, so a missing key does not
    break startup for requests that never search the web."""

    global _search

    if _search is None:
        _search = TavilySearch(
            max_results=5,
            tavily_api_key=require("TAVILY_API_KEY", TAVILY_API_KEY),
        )

    return _search


def content_text(content) -> str:
    """Flatten a chat model reply to plain text.

    Gemini returns content as a string OR as a list of parts (strings or
    dicts with a "text" key), depending on the model and response.
    """

    if isinstance(content, list):
        return "".join(
            item.get("text", "") if isinstance(item, dict) else str(item)
            for item in content
        )

    return str(content)


def chat(user_query: str):

    # Decide whether web search is required
    router_prompt = f"""
You are a query classifier.

Decide whether the user query requires a web search.

Return ONLY one word:

SEARCH
or
NO_SEARCH

Use SEARCH for:
- Latest information
- Current news
- Current events
- Recent prices
- Current weather
- Recent updates
- Information that may have changed recently

Use NO_SEARCH for:
- Normal conversation
- General knowledge
- Explanations
- Coding questions
- Greetings
- Questions that can be answered from your existing knowledge

User Query:
{user_query}
"""

    decision_response = get_google_llm().invoke(
        [HumanMessage(content=router_prompt)]
    )

    decision = content_text(decision_response.content).strip().upper()


    # Web search required
    if decision == "SEARCH":

        search_result = get_search().invoke({
            "query": user_query
        })

        prompt = f"""
Answer the user's question using the web search results.

User Question:
{user_query}

Web Search Results:
{search_result}

Rules:
- Give an accurate answer.
- Use the search results as your source.
- If the search results do not contain enough information, say so.
"""

        response = get_google_llm().invoke(
            [HumanMessage(content=prompt)]
        )

        return content_text(response.content)


    # Normal question
    response = get_google_llm().invoke([
        HumanMessage(content=user_query)
    ])

    return content_text(response.content)