"""
Milestone 7a: the Critic's search tool, served over MCP instead of called
as a plain Python function -- the same step phase3-multiagent took in the
learning roadmap (inline tool -> tool served over MCP), applied to this
project's real pipeline.

This server doesn't know anything new about search -- it's a thin MCP
wrapper around the exact, unchanged search_web() from Milestone 1's
search_tool.py.

Not meant to be run directly by a person -- critic.py launches it as a
subprocess and talks to it over MCP (stdio).
"""

import json

from mcp.server.mcpserver import MCPServer

from app.agents.search_tool import search_web

mcp = MCPServer("trustfeed-search")


@mcp.tool()
def search_web_tool(query: str) -> str:
    """Search the public web for evidence about a specific, narrow question or claim."""
    results = search_web(query)
    return json.dumps([r.model_dump() for r in results])


if __name__ == "__main__":
    mcp.run()
