import re


def extract_memory(question: str):
    """
    Extract important user facts from messages.
    Returns a memory string or None.
    """
    question = question.strip()

    match = re.search(r"my name is (.+)", question, re.IGNORECASE)
    if match:
        return f"User's name is {match.group(1).strip()}."

    match = re.search(r"i am preparing for (.+)", question, re.IGNORECASE)
    if match:
        return f"Preparing for {match.group(1).strip()}."

    match = re.search(r"i study in (.+)", question, re.IGNORECASE)
    if match:
        return f"Studies in {match.group(1).strip()}."

    return None
