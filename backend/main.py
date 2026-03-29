"""Fire Shield backend entry point."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.config.main:app",
        host="0.0.0.0",
        port=8100,
        reload=True,
    )
